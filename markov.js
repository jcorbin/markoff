function Markov(options) {
    if (!(this instanceof Markov)) return new Markov(options);
    options = options || {};
    this.stateSize = options.stateSize || 1;
    this.transitions = {};
    this.start = this.createState();
    this.transitions[this.start] = [];
    if (options.key) this.key = options.key;
}

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

Markov.prototype.save = function() {
    return {
        stateSize: this.stateSize,
        transitions: this.transitions,
    };
};

Markov.load = function(data, options) {
    return (new Markov(options)).load(data);
};

Markov.prototype.load = function(data) {
    this.stateSize = data.stateSize;
    this.transitions = data.transitions;
    return this;
};

Markov.prototype.addTransition = function addTransition(state, token) {
    return this.addWeightedTransition(state, 1, token);
};

Markov.prototype.addWeightedTransition = function addWeightedTransition(state, w, token) {
    if (this.transitions.hasOwnProperty(state)) {
        return this.inSort(this.transitions[state], w, token);
    } else {
        this.transitions[state] = [[w, token]];
        return this.transitions[state];
    }
};

Markov.prototype.addWeightedTransitions = function addWeightedTransitions(state, newWTokens) {
    var self = this;
    newWTokens.forEach(function(wToken) {
        self.addWeightedTransition(state, wToken[0], wToken[1]);
    });
};

Markov.prototype.inSort = function inSort(wTokens, w, token) {
    var lo = 0, hi = wTokens.length-1;
    while (lo <= hi) {
        var q = Math.floor(lo / 2 + hi / 2);
        if   (this.tokenRel(token, wTokens[q][1])) hi = q-1;
        else                                       lo = q+1;
    }
    if (wTokens[lo] && wTokens[lo][1] === token) {
        wTokens[lo][0] += w;
    } else {
        wTokens.splice(lo, 0, [w, token]);
    }
    return wTokens;
};

Markov.prototype.tokenRel = function tokenRel(a, b) {
    return ('' + a) <= ('' + b);
};

Markov.prototype.addTokens = function addTokens(tokens) {
    var self = this;
    step(this.createState(), 0);
    function step(last, i) {
        var token = tokens[i];
        if (token === undefined) {
            if (i === 0) return;
            token = null;
        }
        self.addTransition(last, token);
        last.shift();
        last.push(self.key(token));
        if (i >= tokens.length) return;
        step(last, i+1);
    }
};

Markov.prototype.merge = function merge(other) {
    if (this.stateSize !== other.stateSize) {
        throw new Error('cannot merge markovs with differing state size');
    }
    return this.mergeTransitions(other.transitions);
};

Markov.prototype.mergeTransitions = function merge(transitions) {
    var self = this;
    Object.keys(transitions).forEach(function(state) {
        self.addWeightedTransitions(state, transitions[state]);
    });
    return self;
};

Markov.prototype.choose = function choose(state, rand) {
    rand = rand || Math.random;
    var wTokens = this.transitions[state];
    if (!wTokens) return null;
    var r = wTokens[0][1];
    var bestK = Math.pow(rand(), 1/wTokens[0][0]);
    for (var i=1, n=wTokens.length; i<n; i++) {
        var k = Math.pow(rand(), 1/wTokens[i][0]);
        if (k > bestK) {
            bestK = k;
            r = wTokens[i][1];
        }
    }
    return r;
};

Markov.prototype.chain = function chain(maxLength, state, rand) {
    maxLength = maxLength || Infinity;
    rand = rand || Math.random;
    state = state || this.createState();
    var result = [];
    while (result.length < maxLength) {
        var token = this.choose(state, rand);
        if (token === null) break;
        result.push(token);
        state.shift();
        state.push(this.key(token));
    }
    return result;
};

Markov.prototype.generatePhrase = function(n, minLength) {
    var phrase = '';
    while (phrase.length < minLength) {
        phrase = this.chain(n).join(' ');
    }
    return phrase;
};

Markov.makeMap = function(data) {
    var map = {};
    if (data.transitions) {
        var markov = Markov.load(data);
        map[markov.stateSize] = markov;
    } else {
        Object.keys(data).forEach(function(key) {
            map[key] = Markov.load(data[key]);
        });
    }
    map.get = function getMarkov(k) {
        if (this[k]) return this[k];
        var best = null;
        Object.keys(this).forEach(function(key) {
            var markov = this[key];
            if (!best ||
                (markov.stateSize <= k && markov.stateSize > best.stateSize)
            ) best = markov;
        });
        if (best) this[k] = best;
        return best;
    };
    map.generatePhrase = function(n, minLength) {
        var markov = this.get(n);
        if (!markov) throw new Error('no markov available for ' + n + '-phrases');
        var phrase = markov.generatePhrase(n, minLength);
        return phrase;
    };
    return map;
};

module.exports = Markov;
