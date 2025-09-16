const QueryEngine = require('@comunica/query-sparql').QueryEngine;

const myEngine = new QueryEngine();

async function main2() {
    const binding_stream = await myEngine.queryBindings(`
PREFIX ldp: <http://www.w3.org/ns/ldp#>
select (count(?o) as ?number)
where {
  ?s ldp:contains ?o
}
`, {
        sources: ['http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/1720183668976/']
    });

    binding_stream.on('data', (data: any) => {
        console.log(data.get('number').value);
    });
}

main2();