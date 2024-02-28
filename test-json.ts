import axios from "axios";

async function test_manas() {
  let headersList = {
    "Accept": "*/*",
    "User-Agent": "Kush"
  }

  let reqOptions = {
    url: "http://10.2.32.126:3001/AGcNKtEIaGcuowME",
    method: "GET",
    headers: headersList,
  }

  let response = await axios.request(reqOptions);
  if (response.status % 10 !== 0) {
    console.log(response.status);
  }
}

async function test_css() {
  let headersList = {
    "Accept": "*/*",
    "User-Agent": "Kush"
  }

  let reqOptions = {
    url: "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/1706802232161/c8315abb-7c68-49f7-9709-0c05f099e99d",
    method: "GET",
    headers: headersList,
  }

  let response = await axios.request(reqOptions);
  console.log(response.status);

  if (response.status % 10 !== 0) {
    console.log(`Error: `, response.status);
  }
}

async function main() {
  const time_start = Date.now();
  const promises: Promise<void>[] = [];
  for (let i = 0; i < 2000; i++) {
    promises.push(test_css());
  }
  await Promise.all(promises);
  const time_end = Date.now();
  console.log(`Time taken: ${time_end - time_start}ms`);
  console.log("Done");  
}

main();