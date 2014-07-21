var test = require('tape');
var util = require('util');
var extend = require('xtend/mutable');

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

var testObjectProto = {
    okState: function assertState(mess, expect) {
        if (expect) {
            Object.keys(expect).forEach(function(key) {
                extend(this.expected[key], expect[key]);
                this.assert.deepEqual(
                    this.the[key],
                    this.expected[key],
                    util.format('expected %s %s', key));
            }.bind(this));
        }
    },
    okStep: function assertStep(step, i) {
        var desc;
        if (typeof step.op === 'function') {
            step.op(this.the);
            desc = step.op.name || ('step ' + i);
        } else {
            var method = step.op[0];
            var args = step.op.slice(1);
            desc = util.format('after %s.%s(%s)', this.name, method,
                args.map(function(arg) {return JSON.stringify(arg);}).join(', '));
            this.the[method].apply(this.the, args);
        }
        this.okState(desc, step.expect);
    },
    okSteps: function assertSteps(steps) {
        steps.forEach(this.okStep, this);
    }
};

function createTestObjects(assert, namedSpecs) {
    Object.keys(namedSpecs).forEach(function(name) {
        var ctx = assert[name] = extend(Object.create(testObjectProto), {
            assert: assert,
            name: name,
        });
        var spec = namedSpecs[name];
        if (spec.create) {
            ctx.the = spec.create();
        } else if (spec.args) {
            ctx.the = spec.type.apply(null, spec.args);
        } else {
            ctx.the = new spec.type();
        }
        if (typeof spec.expected === 'function') {
            ctx.expected = spec.expected();
        } else if (spec.expected) {
            ctx.expected = copy(spec.expected);
        } else {
            ctx.expected = {};
        }
        ctx.okState(util.format('inital %s object: %s', spec.type.name, name));
    });
}

createTestObjects.wrapper = function(defaultSpec, defaultNames) {
    function namesToSpec(names) {
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
    defaultNames = namesToSpec(defaultNames);
    return function(desc, names, func) {
        var namedSpecs;
        if (typeof names === 'function') {
            func = names;
            namedSpecs = defaultNames;
        } else {
            namedSpecs = namesToSpec(names);
        }
        test(desc, function(assert) {
            createTestObjects(assert, namedSpecs);
            func(assert);
        });
    };
};

module.exports = createTestObjects;
