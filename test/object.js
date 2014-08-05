module.exports = TestObject;

var test = require('tape');
var util = require('util');
var extend = require('xtend/mutable');

TestObject.harness = function testObjectHarness(defaultSpec, defaultNames) {
    defaultNames = namesToSpec(defaultSpec, defaultNames);
    return function(desc, names, func) {
        var namedSpecs;
        if (typeof names === 'function') {
            func = names;
            namedSpecs = defaultNames;
        } else {
            namedSpecs = namesToSpec(defaultSpec, names);
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

function namesToSpec(defaultSpec, names) {
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
}

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
    Object.keys(expect).forEach(function(key) {
        extend(this.expected[key], expect[key]);
        this.assert.deepEqual(
            this.the[key],
            this.expected[key],
            util.format('expected %s %s', mess, key));
    }.bind(this));
};

TestObject.prototype.okStep = function okStep(step, i) {
    var desc;
    if (typeof step.op === 'function') {
        desc = step.op.name || ('step ' + i);
        step.op(this.the);
    } else {
        var method = step.op[0];
        var args = step.op.slice(1);
        var meth = this.the[method];
        desc = util.format('after %s.%s(%s)', this.name, method,
            args.map(function(arg) {return JSON.stringify(arg);}).join(', '));
        meth.apply(this.the, args);
    }
    this.okState(desc, step.expect);
};

TestObject.prototype.okSteps = function okSteps(steps) {
    steps.forEach(this.okStep, this);
};

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
