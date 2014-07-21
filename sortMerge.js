function sortMerge(a, b) {
    var i = 0, n = a.length;
    var j = 0, m = b.length;
    var c = [];
    while (i < n && j < m) {
        if      (a[i] < b[j]) c.push(a[i++]);
        else if (b[i] < a[j]) c.push(b[j++]);
        else {
            c.push(a[i]);
            i++;
            j++;
        }
    }
    while (i < n) c.push(a[i++]);
    while (j < m) c.push(b[j++]);
    return c;
}

function sortMergeInto(a, b) {
    var i = 0, n = a.length;
    var j = 0, m = b.length;
    while (i < n && j < m) {
        if (a[i] < b[j]) {
            i++;
        } else if (b[i] < a[j]) {
            a.splice(i, 0, b[j++]);
            n++;
        } else {
            i++;
            j++;
        }
    }
    while (j < m) a.push(b[j++]);
    return a;
}

module.exports = sortMerge;
module.exports.into = sortMergeInto;
