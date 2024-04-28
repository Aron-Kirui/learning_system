const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const { check, validationResult } = require('express-validator');
const app = express();

// Configure session middleware
app.use(session({
    secret: 'kajpgfjq9o2300489134kwqnl68-0923-3ejkduwe3sak',
    resave: false,
    saveUninitialized: true
}));

// Create MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1245kirui',
    database: 'lms_app'
});

// Connect to MySQL
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
    }
    console.log('Connected to MySQL.');
});

// Serve static files from the default directory
app.use(express.static(__dirname));

// Set up middleware to parse incoming JSON data
app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).send('Unauthorized');
    }
}

// Define a User representation for clarity
const User = {
    tableName: 'users',
    createUser: function(newUser, callback) {
        connection.query('INSERT INTO ' + this.tableName + ' SET ?', newUser, callback);
    },
    getUserByEmail: function(email, callback) {
        connection.query('SELECT * FROM ' + this.tableName + ' WHERE email = ?', email, callback);
    },
    getUserByUsername: function(username, callback) {
        connection.query('SELECT * FROM ' + this.tableName + ' WHERE username = ?', username, callback);
    }
};

// Registration route
app.post('/register', [
    // Validate email and username fields
    check('email').isEmail(),
    check('username').isAlphanumeric().withMessage('Username must be alphanumeric'),

    // Custom validation to check if email and username are unique
    check('email').custom(async (value) => {
        const user = await User.getUserByEmail(value);
        if (user) {
            throw new Error('Email already exists');
        }
    }),
    check('username').custom(async (value) => {
        const user = await User.getUserByUsername(value);
        if (user) {
            throw new Error('Username already exists');
        }
    }),
], async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

    // Create a new user object
    const newUser = {
        email: req.body.email,
        username: req.body.username,
        password: hashedPassword,
        full_name: req.body.full_name
    };

    // Insert user into MySQL
    User.createUser(newUser, (error, results, fields) => {
        if (error) {
            console.error('Error inserting user: ' + error.message);
            return res.status(500).json({ error: error.message });
        }
        console.log('Inserted a new user with id ' + results.insertId);
        res.status(201).json(newUser);
    });
});

// Login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Retrieve user from database
    connection.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            res.status(401).send('Invalid username or password');
        } else {
            const user = results[0];
            // Compare passwords
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) throw err;
                if (isMatch) {
                    // Store user in session
                    req.session.user = user;
                    res.send('Login successful');
                } else {
                    res.status(401).send('Invalid username or password');
                }
            });
        }
    });
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.send('Logout successful');
});

// Route to save selected courses
app.post('/save-selected-courses', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    const selectedCourses = req.body.courses;

    if (!selectedCourses || !Array.isArray(selectedCourses)) {
        return res.status(400).send('Invalid selected courses data');
    }

    const selectedCoursesJson = JSON.stringify(selectedCourses);

    connection.query('UPDATE users SET selected_courses = ? WHERE id = ?', [selectedCoursesJson, userId], (err, result) => {
        if (err) {
            console.error('Error saving selected courses:', err);
            res.status(500).send('Error saving selected courses');
        } else {
            console.log('Selected courses saved for user', userId);
            res.status(200).send('Selected courses saved successfully');
        }
    });
});

// Route to retrieve selected courses
app.get('/get-selected-courses', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    connection.query('SELECT selected_courses FROM users WHERE id = ?', [userId], (err, result) => {
        if (err) {
            console.error('Error fetching selected courses:', err);
            res.status(500).send('Error fetching selected courses');
        } else {
            if (result.length === 0 || !result[0].selected_courses) {
                return res.status(404).send('Selected courses not found');
            }
            const selectedCourses = JSON.parse(result[0].selected_courses);
            res.status(200).json(selectedCourses);
        }
    });
});

// Dashboard route
app.get('/dashboard', isAuthenticated, (req, res) => {
    const userFullName = req.session.user.full_name;
    res.render('dashboard', { fullName: userFullName });
});

// Start server
const PORT = 4910;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});