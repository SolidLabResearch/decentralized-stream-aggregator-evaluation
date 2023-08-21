import { MongoClient } from 'mongodb';

async function main() {
    const uri = 'mongodb://127.0.0.1:27017'; // Replace with your MongoDB URI
    const client = new MongoClient(uri);

    try {
        // Connect to the MongoDB server
        await client.connect();
        console.log('Connected to the database');

        // Specify the database and collection
        const database = client.db('mydb'); // Replace 'mydb' with your database name
        const collection = database.collection('documents'); // Replace 'documents' with your collection name
        
        // Insert a document
        const document = { name: 'John Doe', age: 30 };
        const result = await collection.insertOne(document);
        console.log(`Inserted document with ID: ${result.insertedId}`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Close the connection when done
        await client.close();
        console.log('Connection closed');
    }
}

main().catch(console.error);
