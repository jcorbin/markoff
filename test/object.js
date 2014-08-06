module.exports = TestObject;

var test = require('tape');
var util = require('util');
var extend = require('xtend/mutable');

TestObject.harness = function testObjectHarness(defaultSpec, defaultNames) {
    defaultNames = TestObject.namesToSpec(defaultSpec, defaultNames);
    return function(desc, names, func) {
        var namedSpecs;
        if (typeof names === 'function') {
            func = names;
            namedSpecs = defaultNames;
        } else {
            namedSpecs = TestObject.namesToSpec(defaultSpec, names);
        }
        test(desc, function(assert) {
            Object.keys(namedSpecs).forEach(function(name) {
                var test = assert[name] = new TestObject(name, namedSpecs[name], assert);
                test.init();
            });
            func(assert);
        });
    };
};

TestObject.namesToSpec = function namesToSpec(defaultSpec, names) {
    var namedSpecs = {};
    if (Array.isArray(names)) {
        names.forEach(function(name) {
            namedSpecs[name] = defaultSpec;
        });
    } else {
        Object.keys(names).forEach(function(name) {
            if (names[name]) {
                namedSpecs[name] = extend({}, defaultSpec, names[name]);
            } else {
                namedSpecs[name] = defaultSpec;
            }
        });
    }
    return namedSpecs;
};

function TestObject(name, spec, assert) {
    this.name = name;
    this.spec = spec;
    this.assert = assert;
    this.the = this.create();
}

TestObject.prototype.init = function init() {
    var desc = util.format('inital %s object: %s', this.spec.type.name, this.name);
    this.expected = this.initialExpectation();
    this.okState(desc);
};

TestObject.prototype.create = function create() {
    if (this.spec.create) {
        return this.spec.create();
    } else if (this.spec.args) {
        return this.spec.type.apply(null, this.spec.args);
    } else {
        return new this.spec.type();
    }
};

TestObject.prototype.initialExpectation = function initialExpectation() {
    if (typeof this.spec.expected === 'function') {
        return this.spec.expected();
    } else if (this.spec.expected) {
        return copy(this.spec.expected);
    } else {
        return {};
    }
};

TestObject.prototype.okState = function okState(mess, expect) {
    if (!expect) return;
    var self = this;
    Object.keys(expect).forEach(function(key) {
        self.expectKey(expect, key, self.the[key], mess);
    });
};

TestObject.prototype.expectKey = function expectKey(expect, key, got, desc) {
    extend(this.expected[key], expect[key]);
    this.checkKey(key, got, desc);
};

TestObject.prototype.checkKey = function checkKey(key, got, desc) {
    this.assert.deepEqual(
        got, this.expected[key],
        util.format('expected %s %s %s', this.name, key, desc));
};

TestObject.prototype.step = function step(spec, i) {
    var op = spec.op;
    var desc, func;
    if (typeof op === 'function') {
        desc = op.name || ('step ' + i);
        func = op.bind(spec, this.the);
    } else {
        var method = op[0], args = op.slice(1);
        desc = util.format('after .%s(%s)', method,
            args.map(function(arg) {return JSON.stringify(arg);}).join(', '));
        func = boundMethod(this.the, method, args);
    }
    return {
        desc: desc,
        func: func
    };
};

TestObject.prototype.okStep = function okStep(spec, i) {
    var step = this.step(spec, i);
    step.func();
    this.okState(step.desc, spec.expect);
};

TestObject.prototype.okSteps = function okSteps(steps) {
    steps.forEach(this.okStep, this);
};

function boundMethod(obj, name, args) {
    var meth = obj[name];
    args.unshift(obj);
    return meth.bind.apply(meth, args);
}

// XXX use deepcopy module
function copy(obj) {
    if (Array.isArray(obj)) {
        return obj.map(copy);
    } else if (typeof obj === 'object') {
        var dupe = {};
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                dupe[prop] = copy(obj[prop]);
            }
        }
        return dupe;
    } else {
        return obj;
    }
}
