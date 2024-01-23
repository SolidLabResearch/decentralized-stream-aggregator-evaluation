async function fetchFileAndLogTime() {
    // const url = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/1700038104650/0e0104bb-a57d-4069-b4c8-0a20ec4e8627';

    const url = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/1700038104650/273d454e-e584-44a1-afec-702b9ea02d17';

    const startTime = Date.now();
    fetch(url).then((response) => {
        const endTime = Date.now();
        const timeTaken = endTime - startTime;
        console.log(`Time taken to fetch the file: ${timeTaken}ms`);
    });    
}

fetchFileAndLogTime();
