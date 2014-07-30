// TODO: support more than single token window
// TODO: transition frequencies

function Markov(options) {
    if (!(this instanceof Markov)) return new Markov(options);
    options = options || {};
    this.stateSize = options.stateSize || 1;
    this.transitions = {};
    this.start = this.createState();
    this.transitions[this.start] = [];
}

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

Markov.load = function(data) {
    return (new Markov()).load(data);
};

Markov.prototype.load = function(data) {
    this.stateSize = data.stateSize;
    this.transitions = data.transitions;
    return this;
};

Markov.prototype.addTransition = function addTransition(state, next) {
    var trans;
    if (this.transitions.hasOwnProperty(state)) {
        trans = this.transitions[state];
    } else {
        trans = this.transitions[state] = [];
    }
    return this.insortState(trans, next);
};

Markov.prototype.insortState = function insortState(trans, state) {
    var lo = 0, hi = trans.length-1;
    while (lo <= hi) {
        var q = Math.floor(lo / 2 + hi / 2);
        if   (this.stateRel(state, trans[q])) hi = q-1;
        else                                  lo = q+1;
    }
    if (trans[lo] !== state) {
        trans.splice(lo, 0, state);
    }
    return trans;
};

Markov.prototype.stateRel = function stateRel(a, b) {
    return ('' + a) <= ('' + b);
};

Markov.prototype.addTokens = function addTokens(tokens) {
    var last = this.createState();
    for (var i=0, n=tokens.length; i<n; i++) {
        var token = tokens[i];
        this.addTransition(last, token);
        last.shift();
        last.push(token);
    }
    if (n > 0) this.addTransition(last, null);
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
        transitions[state].forEach(function(next) {
            self.addTransition(state, next);
        });
    });
    return self;
};

Markov.prototype.choose = function choose(state, rand) {
    rand = rand || Math.random;
    var trans = this.transitions[state];
    if (!trans) return null;
    return trans[Math.floor(rand() * trans.length)];
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
        state.push(token);
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
