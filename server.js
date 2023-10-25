const express = require('express');
const exhbs = require('express-handlebars');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for body parsing and static files
app.engine('hbs', exhbs({
    extname: 'hbs',
    defaultLayout: false,
    layoutsDir: path.join(__dirname, 'views/layouts'), 
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views')); 
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: 'bek',
    resave: false,
    saveUninitialized: true
}));

const userData = JSON.parse(fs.readFileSync('user.json', 'utf8'));

// Login page
app.get('/', (req, res) => {
    res.render('login');
});

// Login submission and validation
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (userData.hasOwnProperty(username) && userData[username] === password) {
        req.session.isAuthenticated = true;
        req.session.username = username;
        res.redirect('/main');
    } else {
        res.render('login', { errorMessage: 'Invalid username or password!' });
    }
});


// Main page (Banking)
app.get('/main', (req, res) => {
    if (req.session.isAuthenticated) {
        const username = req.session.username;
        res.render('banking', { username });
    } else {
        res.redirect('/');
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Register page
app.get('/register', (req, res) => {
    res.render('register');
});

// Registration form handling
app.post('/register', (req, res) => {
    
    res.redirect('/');
});

// Balance page
app.get('/balance', (req, res) => {

    const balanceData = 200; 
    res.render('balance', { balanceData });
});

app.listen(PORT, () => {
    console.log(`Server is at ${PORT}`);
});
