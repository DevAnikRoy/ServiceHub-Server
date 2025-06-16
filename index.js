require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const jwtSecret = process.env.JWT_SECRET;

// Middleware to verify JWT
const verify = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
        return res.status(401).json("Unauthorized access");
    }
    try {
        const token = auth.split(" ")[1];
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(403).json("Forbidden access");
    }
};

const generateToken = (user) => {
    return jwt.sign({ email: user.email }, jwtSecret, { expiresIn: "1d" });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ngwkmsl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {



    try {
        await client.connect();
        const db = client.db("service-Hub");

        await db.command({ ping: 1 });
        console.log("Connected to MongoDB");

        await db.createCollection("bookings");
        await db.createCollection("users");
        await db.createCollection("services");

        const users = db.collection("users");
        const services = db.collection("services");
        const bookings = db.collection("bookings");

        // Root
        app.get("/", (req, res) => res.send("ServiceHub backend running"));

        // Auth
        app.post("/register", async (req, res) => {
            const user = req.body;
            const existing = await users.findOne({ email: user.email });
            if (existing) return res.status(400).json("User already exists");
            await users.insertOne(user);
            const token = generateToken(user);
            res.status(201).json({ token, user });
        });

        app.post("/login", async (req, res) => {
            const { email } = req.body;
            const token = generateToken({ email });
            res.json({ token, user: { email } });
        });

        // Add Service
        app.post("/addservice", verify, async (req, res) => {
            const payload = req.body;
            const user = await users.findOne({ email: req.user.email });
            if (!user) return res.status(404).json("User not found");
            payload.providerId = user._id;
            payload.providerName = user.name;
            payload.providerEmail = user.email;
            payload.providerImage = user.imageUrl;
            payload.createdAt = new Date();
            await services.insertOne(payload);
            res.json("Service added");
        });

        // All Services
        app.get("/allservices", async (req, res) => {
            const all = await services.find().sort({ createdAt: -1 }).toArray();
            res.json(all);
        });

        // Featured (limit 6)
        app.get("/featuredservices", async (req, res) => {
            const featured = await services.find().limit(6).sort({ createdAt: -1 }).toArray();
            res.json(featured);
        });

        // Get Service by ID
        app.get("/services/:id", async (req, res) => {
            const id = req.params.id;
            const service = await services.findOne({ _id: new ObjectId(id) });
            res.json(service);
        });


        // Start server
        app.listen(port, () => {
            console.log(`ServiceHub backend running on port ${port}`);
        });
    } finally {
        // optional: await client.close();
    }
}

run().catch(console.dir);
