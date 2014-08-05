var MemDB = require('memdb');
var once = require('./lib/continuable-once');

function Markov(options) {
    if (!(this instanceof Markov)) return new Markov(options);
    options = options || {};
    this.db = options.db || MemDB({
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
            var startKey = 'transitions/' + self.start;
            self.db.get(startKey, function(err, val) {
                if (err && !err.notFound) return next(err);
                if (val !== undefined) return next();
                self.db.put(startKey, [], next);
            });
        },
        function(next) {
            self.ready = true;
            next();
        }
    );
}

Markov.prototype.ready = false;

Markov.prototype.tokenRel = function tokenRel(a, b) {
    return ('' + a) < ('' + b);
};

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
        if (pair.key.indexOf('transitions/') === 0) {
            var key = pair.key.slice(12);
            data.transitions[key] = pair.value;
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
            bat.put('transitions/' + key, wTokens);
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
        if (key.indexOf('transitions/') === 0 ||
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
    var stateKey = 'transitions/' + state;
    this.db.get(stateKey, function(err, wTokens) {
        if (err && !err.notFound) return done(err);
        if (wTokens === undefined) {
            wTokens = [[w, token]];
        } else {
            self.inSort(wTokens, w, token);
        }
        self.db.put(stateKey, wTokens, done);
    });
});

Markov.prototype.addWeightedTransitions = withReady(function addWeightedTransitions(state, newWTokens, done) {
    var self = this;
    var stateKey = 'transitions/' + state;
    this.db.get(stateKey, function(err, wTokens) {
        if (err && !err.notFound) return done(err);
        if (wTokens === undefined) {
            wTokens = newWTokens;
        } else {
            self.inSortMerge(wTokens, newWTokens);
        }
        self.db.put(stateKey, wTokens, done);
    });
});

Markov.prototype.inSort = function inSort(wTokens, w, token) {
    var lo = 0, hi = wTokens.length-1;
    while (lo <= hi) {
        var q = Math.floor(lo / 2 + hi / 2);
        if      (this.tokenRel(token, wTokens[q][1])) hi = q-1;
        else if (this.tokenRel(wTokens[q][1], token)) lo = q+1;
        else {
            wTokens[q][0] += w;
            return wTokens;
        }
    }
    wTokens.splice(lo, 0, [w, this.copyToken(token)]);
    return wTokens;
};

Markov.prototype.inSortMerge = function inSortMerge(wTokens, otherWTokens) {
    var i = 0, n = wTokens.length;
    var j = 0, m = otherWTokens.length;
    while (i < n && j < m) {
        if (this.tokenRel(wTokens[i][1], otherWTokens[j][1])) {
            i++;
        } else if (this.tokenRel(otherWTokens[j][1], wTokens[i][1])) {
            wTokens.splice(i++, 0, this.copyWToken(otherWTokens[j++]));
            n++;
        } else {
            wTokens[i++][0] += otherWTokens[j++][0];
        }
    }
    while (j < m) {
        wTokens.push(this.copyWToken(otherWTokens[j++]));
    }
};

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
        if (pair.key.indexOf('transitions/') === 0) {
            add(pair.key.slice(12), pair.value);
        }
    }).on('error', finish).on('end', function() {
        ended = true;
        if (!adding && !Q.length) finish();
    });
    function add(state, wTokens) {
        if (adding) {
            Q.push([state, wTokens]);
        } else {
            adding = true;
            self.addWeightedTransitions(state, wTokens, function(err) {
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
    var stateKey = 'transitions/' + state;
    this.db.get(stateKey, function(err, wTokens) {
        var bestK = null, bestToken = null;
        if (!err && wTokens) {
            bestToken = wTokens[0][1];
            bestK = Math.pow(rand(), 1/wTokens[0][0]);
            for (var i=1, n=wTokens.length; i<n; i++) {
                var wToken = wTokens[i];
                var w = wToken[0], token = wToken[1];
                var k = Math.pow(rand(), 1/w);
                if (k > bestK) {
                    bestK = k;
                    bestToken = token;
                }
            }
        }
        callback(err, bestToken);
    });
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
