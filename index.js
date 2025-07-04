require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 3000;

// app.use(cors());
app.use(cors({
  origin: "*",
  credentials: true
}))
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
        // await client.connect();
        const db = client.db("service-Hub");

        await db.command({ ping: 1 });
        // console.log("Connected to MongoDB");

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
            // console.log(" Google register body:", req.body);
            const { name, email, imageUrl } = req.body;

            if (!email || !name) {
                return res.status(400).json("Required fields missing");
            }

            const existing = await users.findOne({ email });
            if (existing) {
                const token = generateToken(existing);
                return res.status(200).json({ token, user: existing });
            }

            const newUser = {
                name,
                email,
                imageUrl: imageUrl || null,
                createdAt: new Date()
            };

            const result = await users.insertOne(newUser);
            // console.log(" Google user inserted:", result);

            const token = generateToken(newUser);
            res.status(201).json({ token, user: result });
        });


        app.post("/login", async (req, res) => {
            const { email } = req.body;
            if (!email) return res.status(400).json("Email is required");

            const user = await users.findOne({ email });
            if (!user) return res.status(404).json("User not found");

            const token = generateToken(user);
            res.json({ token, user });
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

        // Get Current User Profile
        app.get("/me", verify, async (req, res) => {
            try {
                const user = await users.findOne({ email: req.user.email });
                if (!user) return res.status(404).json("User not found");

                res.json(user);
            } catch (error) {
                res.status(500).json("Server error");
            }
        });

        // My Services
        app.get("/myservices", verify, async (req, res) => {
            const servicesList = await services.find({ providerEmail: req.user.email }).toArray();
            res.json(servicesList);
        });

        // Update Service
        app.patch("/services/:id", verify, async (req, res) => {
            const id = req.params.id;
            const update = req.body;

            const result = await services.updateOne(
                { _id: new ObjectId(id), providerEmail: req.user.email },
                { $set: update }
            );

            if (result.modifiedCount > 0) {
                res.json({ message: "Service updated" });
            } else {
                res.status(400).json("No changes applied");
            }
        });

        // Delete Service
        app.delete("/services/:id", verify, async (req, res) => {
            const id = req.params.id;
            const service = await services.findOne({ _id: new ObjectId(id) });
            if (service.providerEmail !== req.user.email)
                return res.status(403).json("Cannot delete others' services");

            await services.deleteOne({ _id: new ObjectId(id) });
            res.json("Service deleted");
        });

        // Book Service
        app.post("/bookservice", verify, async (req, res) => {
            const payload = req.body;
            const user = await users.findOne({ email: req.user.email });
            payload.userEmail = user.email;
            payload.userName = user.name;
            payload.userImage = user.imageUrl;
            payload.status = "pending";
            payload.createdAt = new Date();
            await bookings.insertOne(payload);
            res.json("Service booked");
        });

        // My Booked Services (User)
        app.get("/mybookings", verify, async (req, res) => {
            const bookingsList = await bookings.find({ userEmail: req.user.email }).toArray();
            res.json(Array.isArray(bookingsList) ? bookingsList : []);

        });

        // Service To-Do (Provider's perspective)
        app.get("/servicetodo", verify, async (req, res) => {
            const result = await bookings.find({ providerEmail: req.user.email }).toArray();
            res.json(Array.isArray(result) ? result : []);
        });

        // Update Status
        app.put("/updatestatus/:id", verify, async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;
            await bookings.updateOne({ _id: new ObjectId(id) }, { $set: { serviceStatus: status } });
            res.json("Status updated");
        });

        // Start server
        app.listen(port, () => {
            // console.log(`ServiceHub backend running on port ${port}`);
        });
    } finally {
        // optional: await client.close();
    }
}

run().catch(console.dir);
