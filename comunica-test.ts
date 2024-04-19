const QueryEngine = require('@comunica/query-sparql').QueryEngine;

const myEngine = new QueryEngine();

async function main() {
    const binding_stream = await myEngine.queryBindings(`
PREFIX ldp: <http://www.w3.org/ns/ldp#>
select (count(?o) as ?number)
where {
  ?s ldp:contains ?o
}
`, {
        sources: ['http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/1713449932229/']
    });

    binding_stream.on('data', (data: any) => {
        console.log(data.get('number').value);
    });
}

main();