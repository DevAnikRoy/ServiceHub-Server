require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');


const app = express()
const port = process.env.PORT || 3000

// middleware

app.use(cors());
app.use(express.json())

// jwt
const jwtSecret = "2e12ebb9076a543ee9539a5216e876008753904163daa83bf2503cdd39c1564b+KArH+PXH/+9zjirFIoXgUGM"

const verify = (req, res, next) => {
    const auth = req.headers.authorization
    console.log(auth)
    if(!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json('invalid token')
    }
    else{
        try{
            const token = auth.split(' ')[1]
            const decode = jwt.verify(token, jwtSecret)
            next()
        }
        catch(error){
            res.status(403).json({message:'invalid expired token', error,auth})
        }
    }
}

const generateToken = (user) => {
    return jwt.sign({ email: user.email }, jwtSecret, { expiresIn: '1d' })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ngwkmsl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("service-Hub").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");


        const db = client.db('service-Hub')

        const serviceCollection = db.collection("services")

        // service-Hub
        app.get('/', (req, res) => {
            res.send('service hub is serving ')
        });

        app.listen(port, () => {
            console.log(`service hub is running on port ${port}`)
        })

        // crud is here

        app.post('/login', async (req, res) => {
            const { email, password } = req.body;
            const token = generateToken({ email })
            res.status(201).json({ token, user: { email } })
        })

        app.post('/addservice', verify, async (req, res) => {
            const payload = req.body;
            await serviceCollection.insertOne(payload)
            res.json('added successfully')
        })


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


