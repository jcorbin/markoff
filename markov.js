var MemDB = require('memdb');
var once = require('./lib/continuable-once');
var series = require('continuable-series');

function Markov(options) {
    if (!(this instanceof Markov)) return new Markov(options);
    options = options || {};
    this.db = options.db || MemDB({
        keyEncoding: 'json',
        valueEncoding: 'json'
    });
    if (options.key) this.key = options.key;
    var self = this;
    this.init = once(
        function(next) {
            self.db.get('stateSize', function(err, val) {
                if (err && !err.notFound) return next(err);
                if (val === undefined) {
                    val = options.stateSize || 1;
                    self.db.put('stateSize', val, function(err) {
                        if (err) return next(err);
                        self.stateSize = val;
                        next();
                    });
                } else if (options.stateSize && val !== options.stateSize) {
                    return next(new Error('stateSize options mismatch db value'));
                } else {
                    self.stateSize = val;
                    next();
                }
            });
        },
        function(next) {
            self.start = self.createState();
            self.ready = true;
            next();
        }
    );
}

Markov.prototype.ready = false;

Markov.prototype.copyWToken = function(wToken) {
    return [wToken[0], this.copyToken(wToken[1])];
};

Markov.prototype.copyToken = function(token) {
    return token;
};

Markov.prototype.key = function(token) {
    return token;
};

Markov.prototype.createState = function() {
    var n = this.stateSize;
    var state = new Array(n);
    for (var i=0; i<n; i++) state[i] = null;
    var m = Math.min(n, arguments.length);
    var j;
    for (i=n-m, j=0; i<n; i++, j++) state[i] = arguments[j];
    return state;
};

Markov.prototype.getData = withReady(function getData(callback) {
    var data = {
        stateSize: this.stateSize,
        transitions: {}
    };
    var finished = false;
    this.db.createReadStream().on('data', function(pair) {
        if (pair.key[0] === 'transitions') {
            var state = pair.key[1];
            var token = pair.key[2];
            var w = pair.value;
            var wToken = [w, token];
            if (data.transitions.hasOwnProperty(state)) {
                data.transitions[state].push(wToken);
            } else {
                data.transitions[state] = [wToken];
            }
        }
    }).on('error', finish).on('end', finish);
    function finish(err) {
        if (finished) return;
        finished = true;
        callback(err, data);
    }
});

Markov.fromData = function fromData(data, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    var mark = new Markov(options);
    mark.init(function(err) {
        if (err) return callback(err);
        mark.setData(data, function(err) {
            if (err) return callback(err);
            callback(null, mark);
        });
    });
};

Markov.prototype.setData = withReady(function setData(data, callback) {
    var self = this;
    this.clearData(function(err) {
        if (err) return callback(err);
        var bat = self.db.batch();
        bat.put('stateSize', data.stateSize);
        Object.keys(data.transitions).forEach(function(key) {
            var wTokens = data.transitions[key];
            wTokens.forEach(function(wToken) {
                var w = wToken[0], token = wToken[1];
                bat.put(['transitions', key, token], w);
            });
        });
        bat.write(function(err) {
            if (!err) self.stateSize = data.stateSize;
            callback(err);
        });
    });
});

Markov.prototype.clearData = withReady(function clearData(callback) {
    var finished = false;
    var bat = this.db.batch();
    this.db.createKeyStream().on('data', function(key) {
        if (key[0] === 'transitions' ||
            key === 'stateSize') {
            bat.del(key);
        }
    }).on('error', finish).on('end', function() {
        bat.write(finish);
    });
    function finish() {
        if (finished) return;
        finished = true;
        callback.apply(this, arguments);
    }
});

Markov.prototype.addTransition = withReady(function addTransition(state, token, done) {
    return this.addWeightedTransition(state, 1, token, done);
});

Markov.prototype.addWeightedTransition = withReady(function addWeightedTransition(state, w, token, done) {
    var self = this;
    this.db.get(['transitions', state, token], function(err, val) {
        if (err && !err.notFound) return done(err);
        if (val === undefined) {
            val = w;
        } else {
            val += w;
        }
        self.db.put(['transitions', state, token], val, done);
    });
});

Markov.prototype.addWeightedTransitions = withReady(function addWeightedTransitions(state, newWTokens, done) {
    var self = this;
    series(newWTokens.map(function(wToken) {
        var w = wToken[0], token = wToken[1];
        self.addWeightedTransition.bind(self, state, w, token);
    }))(done);
});

Markov.prototype.addTokens = withReady(function addTokens(tokens, callback) {
    if (!callback) throw new Error('fuuuu');
    var self = this;
    step(this.createState(), 0);
    function step(last, i) {
        var token = tokens[i];
        if (token === undefined) {
            if (i === 0) return callback();
            token = null;
        }
        self.addTransition(last, token, function(err) {
            if (err) return callback(err);
            last.shift();
            last.push(self.key(token));
            if (i >= tokens.length) return callback();
            step(last, i+1);
        });
    }
});

Markov.prototype.merge = withReady(function merge(other, callback) {
    var self = this;
    if (!other.ready) {
        return other.init(function(err) {
            if (err) return callback(err);
            self.merge(other, callback);
        });
    }
    if (this.stateSize !== other.stateSize) {
        return callback(new Error('cannot merge markovs with differing state size'));
    }
    // TODO: use a write/transform stream maybe batch
    var Q = [], adding = false, finished = false, ended = false;
    other.db.createReadStream().on('data', function(pair) {
        if (pair.key[0] === 'transitions') {
            add(pair.key[1], pair.key[2], pair.value);
        }
    }).on('error', finish).on('end', function() {
        ended = true;
        if (!adding && !Q.length) finish();
    });
    function add(state, token, w) {
        if (adding) {
            Q.push([state, token, w]);
        } else {
            adding = true;
            self.addWeightedTransition(state, w, token, function(err) {
                adding = false;
                if (err) return finish(err);
                if (Q.length) add.apply(null, Q.shift());
                else if (ended) finish();
            });
        }
    }
    function finish() {
        if (finished) return;
        finished = true;
        callback.apply(this, arguments);
    }
});

Markov.prototype.choose = withReady(function choose(state, rand, callback) {
    rand = rand || Math.random;
    var finished = false;
    var bestK = null, bestToken = null;
    var stream = this.db.createReadStream().on('data', {
        gte: ['transitions', state]
    }, function(pair) {
        if (pair.key[0] !== state) return stream.close();
        var token = pair.key[1];
        var w = pair.value;
        var k = Math.pow(rand(), 1/w);
        if (bestK === null || k > bestK) {
            bestK = k;
            bestToken = token;
        }
    }).on('error', finish).on('end', function() {
        finish(null, bestToken);
    });
    function finish() {
        if (finished) return;
        finished = true;
        callback.apply(this, arguments);
    }
});

Markov.prototype.chain = withReady(function chain(maxLength, state, rand, callback) {
    maxLength = maxLength || Infinity;
    rand = rand || Math.random;
    var result = [];
    var self = this;
    step(state || this.createState());
    function step(state) {
        self.choose(state, rand, function(err, token) {
            if (!err && token !== null) {
                result.push(token);
                if (result.length < maxLength) {
                    state.shift();
                    state.push(self.key(token));
                    return step(state);
                }
            }
            callback(err, result);
        });
    }
});

function withReady(func) {
    return function() {
        var self = this;
        var args = arguments;
        var callback = args[args.length-1];
        if (this.ready) {
            func.apply(self, args);
        } else {
            this.init(function(err) {
                if (err) return callback(err);
                func.apply(self, args);
            });
        }
    };
}

module.exports = Markov;
