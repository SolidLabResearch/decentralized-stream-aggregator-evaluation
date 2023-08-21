const find = require('find-process');
const pidusage = require('pidusage')

find('name', 'aggregation').then(function (list: any) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].name === 'node') {
            pidusage(list[i].pid, function (err: any, stats: any) {
                console.log(`${stats.timestamp} - ${stats.memory * 0.000001} - ${stats.cpu}}`);
            })
        }
    }
});