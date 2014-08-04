function Markov(options) {
    if (!(this instanceof Markov)) return new Markov(options);
    options = options || {};
    this.stateSize = options.stateSize || 1;
    this.transitions = {};
    this.start = this.createState();
    this.transitions[this.start] = [];
    if (options.key) this.key = options.key;
}

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
    if (this.transitions.hasOwnProperty(state)) {
        return this.inSortMerge(this.transitions[state], newWTokens);
    } else {
        this.transitions[state] = newWTokens;
        return this.transitions[state];
    }
};

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
    var self = this;
    Object.keys(other.transitions).forEach(function(state) {
        self.addWeightedTransitions(state, other.transitions[state]);
    });
    return self;
};

Markov.prototype.choose = function choose(state, rand) {
    rand = rand || Math.random;
    var wTokens = this.transitions[state];
    var r = null;
    if (wTokens) {
        r = wTokens[0][1];
        var bestK = Math.pow(rand(), 1/wTokens[0][0]);
        for (var i=1, n=wTokens.length; i<n; i++) {
            var k = Math.pow(rand(), 1/wTokens[i][0]);
            if (k > bestK) {
                bestK = k;
                r = wTokens[i][1];
            }
        }
    }
    return r;
};

Markov.prototype.chain = function chain(maxLength, state, rand) {
    maxLength = maxLength || Infinity;
    rand = rand || Math.random;
    var result = [];
    var self = this;
    return step(state || this.createState());
    function step(state) {
        var token = self.choose(state, rand);
        if (token !== null) {
            result.push(token);
            if (result.length < maxLength) {
                state.shift();
                state.push(self.key(token));
                return step(state);
            }
        }
        return result;
    }
};

module.exports = Markov;
