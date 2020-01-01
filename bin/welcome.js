const gradient = require("gradient-string");

function welcome() {
  const logo = gradient.pastel("ScriptPal 🤘\n");

  console.log(logo);
}

module.exports = welcome;
