const total = 3000;
const mod = Math.floor(total / 100);

(async function () {
    console.log('starting runs');
    const promises: Promise<any>[] = [];
    for (let i = 0; i < total; ++i) {
        promises.push(doCall(i));
    }
    console.log(await Promise.all(promises));
})();

async function doCall(i: any) {
    const res = await fetch('http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/1711361336170/ccc5c600-3e2a-4155-8d0f-a1209d53fb5d');
    if (i % mod === 0) {
        console.log(i, res.status);
    }
    return res.status;
}