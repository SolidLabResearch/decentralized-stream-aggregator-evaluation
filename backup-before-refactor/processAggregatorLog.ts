const logFile = "/home/kush/aggregation.log";
const cumulativeTimes = new Map<string, number>();

import * as fs from "fs";
import * as readline from "readline";
import * as csv from "csv-writer";

interface LogEntry {
    msg: string;
    time: string;
}

interface TimeDiffData {
    msg1: string;
    msg2: string;
    time1: string;
    time2: string;
    time_diff_seconds: number;
}

function processLogData(logfiepath: string, outputCSV: string) {
    const logs: LogEntry[] = [];
    const lineReader = readline.createInterface({
        input: fs.createReadStream(logfiepath),
    });

    lineReader.on('line', (line: string) => {
        const logEntry: LogEntry = JSON.parse(line);
        logs.push(logEntry);
    });

    lineReader.on('close', () => {
        logs.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        const timeDiffData: TimeDiffData[] = [];
        for (let i = 1; i < logs.length; i++) {
            const time1 = new Date(logs[i - 1].time);
            const time2 = new Date(logs[i].time);
            const time_diff_seconds = (time2.getTime() - time1.getTime()); // let's keep it in milliseconds for now

            timeDiffData.push({
                msg1: logs[i - 1].msg,
                time1: logs[i - 1].time,
                msg2: logs[i].msg,
                time2: logs[i].time,
                time_diff_seconds: time_diff_seconds
            });
        }

        for (let entry of timeDiffData) {
            let message_one = entry.msg1;
            let message_two = entry.msg2;
            let time_diff = entry.time_diff_seconds;

            const key = `${message_one},${message_two}`;
            if (cumulativeTimes.has(key)) {
                cumulativeTimes.set(key, cumulativeTimes.get(key)! + time_diff);
            }
            else {
                cumulativeTimes.set(key, time_diff);
            }
        }

        const csvWriter = csv.createObjectCsvWriter({
            path: outputCSV,
            header: [
                { id: 'msg1', 'title': 'log_message1' },
                { id: 'msg2', 'title': 'log_message2' },
                { id: 'time_diff_seconds', title: 'diff' },
            ],
        });

        const records = Array.from(cumulativeTimes.entries()).map(([key, value]) => {
            const [msg1, msg2] = key.split(',');
            return { msg1, msg2, time_diff_seconds: value };
        });

        csvWriter.writeRecords(records).then(() => {
            console.log('CSV file written successfully');
        }).catch((err) => {
            console.error(err);
        });
    });
}

processLogData(logFile, "output.csv");