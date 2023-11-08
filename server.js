const express = require('express');
const exhbs = require('express-handlebars');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000;
const randomstring = require("randomstring");

// Middleware for body parsing and static files
app.engine(
  "hbs",
  exhbs({
    extname: "hbs",
    defaultLayout: false,
    layoutsDir: path.join(__dirname, "views/layouts"),
  })
);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));

// Session configuration
app.use(
  session({
    secret: "secretkey",
    resave: true,
    saveUninitialized: false,
  })
);

const userData = JSON.parse(fs.readFileSync("user.json", "utf8"));
const accountData = JSON.parse(fs.readFileSync("account.json", "utf8"));

// Login page
app.get("/", (req, res) => {
  res.render("login", { errorMessage: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!userData.hasOwnProperty(username)) {
    res.render("login", { errorMessage: "Not a registered username" });
  } else if (userData[username] !== password) {
    res.render("login", { errorMessage: "Invalid password" });
  } else {
    req.session.isAuthenticated = true;
    req.session.username = username;
    res.redirect("/main");
  }
});

// Main page (Banking)
app.get("/main", (req, res) => {
  if (req.session.isAuthenticated) {
    const username = req.session.username;
    const successMessage = req.session.successMessage;
    const errorMessage = req.session.errorMessage;

    req.session.successMessage = null;
    req.session.errorMessage = null;

    res.render("banking", { username, successMessage, errorMessage });
  } else {
    res.redirect("/");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// Register page
app.post("/register", (req, res) => {
  const { email, newPassword } = req.body;

  if (userData.hasOwnProperty(email)) {
    return res.redirect("/register?error=User already exists.");
  }

  userData[email] = newPassword;
  fs.writeFileSync("user.json", JSON.stringify(userData, null, 2));

  res.redirect("/register?success=true");
});

app.get("/register", (req, res) => {
  let successMessage = req.query.success ? "Successfully registered!" : null;
  let errorMessage = req.query.error || null;

  res.render("register", {
    successMessage: successMessage,
    errorMessage: errorMessage,
  });
});

// Balance page
app.get("/balance", (req, res) => {
  if (req.session.isAuthenticated) {
    const username = req.session.username;
    const accountNumber = req.query.accountNumber;

    const accountData = JSON.parse(fs.readFileSync("account.json", "utf8"));

    if (accountData.hasOwnProperty(accountNumber)) {
      const account = accountData[accountNumber];
      res.render("balance", {
        username,
        accountNumber,
        accountType: account.accountType,
        balanceData: account.accountBalance,
      });
    } else {
      req.session.errorMessage = "Account not found";
      res.redirect("/main");
    }
  } else {
    res.redirect("/");
  }
});

app.post("/balance", (req, res) => {
  if (req.session.isAuthenticated) {
    const accountID =
      req.body.accountNumber || req.session.actionData.accountNumber;
    const accountData = readAccountsData();

    if (accountData[accountID]) {
      res.redirect(`/balance?accountNumber=${encodeURIComponent(accountID)}`);
    } else {
      req.session.errorMessage = "Invalid account number";
      res.redirect("/main");
    }
  } else {
    res.redirect("/");
  }
});

// Deposit page
app.get("/deposit", (req, res) => {
  if (req.session.isAuthenticated) {
    const username = req.session.username;
    const accountNumber = req.query.accountNumber;
    const depositMessage = req.session.depositMessage;

    req.session.depositMessage = null;

    res.render("deposit", { username, accountNumber, depositMessage });
  } else {
    res.redirect("/");
  }
});

// Handle successful deposit
app.post("/deposit", (req, res) => {
  if (req.session.isAuthenticated) {
    const accountNumber = req.body.accountNumber;
    const depositAmount = parseFloat(req.body.depositAmount);

    const accountData = readAccountsData();

    if (
      !isNaN(depositAmount) &&
      depositAmount > 0 &&
      accountData.hasOwnProperty(accountNumber)
    ) {
      accountData[accountNumber].accountBalance += depositAmount;
      fs.writeFileSync("account.json", JSON.stringify(accountData, null, 2));

      const depositMessage = `Deposit Successful: $${depositAmount} deposited to account ${accountNumber}`;

      res.render("deposit", {
        username: req.session.username,
        accountNumber,
        depositMessage,
        depositAmount,
      });
    } else {
      const depositMessage = "Invalid deposit amount or account not found";

      res.render("deposit", {
        username: req.session.username,
        accountNumber,
        depositMessage,
      });
    }
  } else {
    res.redirect("/");
  }
});

// Withdrawal page
app.get("/withdrawal", (req, res) => {
  if (req.session.isAuthenticated) {
    const username = req.session.username;
    const accountNumber = req.query.accountNumber;
    const withdrawalSuccessMessage = req.session.withdrawalSuccessMessage;
    const errorMessage = req.session.errorMessage;

    const accountData = readAccountsData();
    if (accountData.hasOwnProperty(accountNumber)) {
      const account = accountData[accountNumber];

      const balance = account.accountBalance;

      res.render("withdrawal", {
        username,
        accountNumber,
        withdrawalSuccessMessage,
        errorMessage,
        balance,
      });
    } else {
      req.session.errorMessage = "Account not found";
      res.redirect("/main");
    }
  } else {
    res.redirect("/");
  }
});

app.post("/withdrawal", (req, res) => {
  if (req.session.isAuthenticated) {
    const accountNumber = req.body.accountNumber;
    const withdrawalAmount = parseFloat(req.body.withdrawalAmount);

    const accountData = readAccountsData();

    if (
      !isNaN(withdrawalAmount) &&
      withdrawalAmount > 0 &&
      accountData.hasOwnProperty(accountNumber)
    ) {
      const account = accountData[accountNumber];

      if (withdrawalAmount <= account.accountBalance) {
        account.accountBalance -= withdrawalAmount;
        fs.writeFileSync("account.json", JSON.stringify(accountData, null, 2));

        const withdrawalSuccessMessage = `Withdrawal Successful: $${withdrawalAmount} withdrawn from account ${accountNumber}`;

        res.render("withdrawal", {
          username: req.session.username,
          accountNumber,
          withdrawalSuccessMessage,
          balance: account.accountBalance,
        });
      } else {
        const errorMessage = "Insufficient Funds";

        res.render("withdrawal", {
          username: req.session.username,
          accountNumber,
          errorMessage,
          balance: account.accountBalance,
          insufficientFundsMessage: errorMessage,
        });
      }
    } else {
      const errorMessage = "Invalid withdrawal amount or account not found";

      res.render("withdrawal", {
        username: req.session.username,
        accountNumber,
        errorMessage,
        balance: accountData[accountNumber].accountBalance,
      });
    }
  } else {
    res.redirect("/");
  }
});

// Open Account page

// Function to read the current accounts data from the JSON file
function readAccountsData() {
  return JSON.parse(fs.readFileSync("account.json", "utf8"));
}

// Function to write updated accounts data to the JSON file
function writeAccountsData(data) {
  fs.writeFileSync("account.json", JSON.stringify(data, null, 2), "utf8");
}

app.post("/openAccount", (req, res) => {
  if (req.session.isAuthenticated) {
    const username = req.session.username;
    const accountType = req.body.accountType;
    const accountsData = readAccountsData();

    const newAccountNumber = String(Number(accountsData.lastID) + 1).padStart(
      7,
      "0"
    );

    accountsData.lastID = newAccountNumber;
    accountsData[newAccountNumber] = {
      accountType: accountType,
      accountBalance: 0,
    };

    writeAccountsData(accountsData);

    const successMessage = `${accountType} Account #${newAccountNumber} Created`;

    req.session.successMessage = successMessage;
    res.redirect("/main");
  } else {
    res.redirect("/");
  }
});

app.get("/openAccount", (req, res) => {
  if (req.session.isAuthenticated) {
    res.render("openAccount", { username: req.session.username });
  } else {
    res.redirect("/");
  }
});

//Port listening
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});