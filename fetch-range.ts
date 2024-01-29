async function fetchDataWithRange(url: string, startByte: number, endByte: number): Promise<ArrayBuffer> {
    const headers = new Headers({
        'Range': `bytes=${startByte}-${endByte}`,
    });

    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error(`Failed to fetch data. Status: ${response.status} ${response.statusText}`);
    }

    return await response.arrayBuffer();
}

// Example usage
const url = 'http://localhost:3000/dataset_participant1/data/1676276846171/02c210d7-ad92-4842-aae7-3d7a2805b90e';
const startByte = 0;
const endByte = 1000;  // Adjust the range according to your requirements

fetchDataWithRange(url, startByte, endByte)
    .then(data => {
        // Process the received data
        console.log(data);
    })
    .catch(error => {
        console.error(error);
    });
