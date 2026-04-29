const { toWhatsappChatId } = require("../utils/phoneFormatter");

const phoneNumberFormatter = function(number) {
  return toWhatsappChatId(number);
}

module.exports = {
  phoneNumberFormatter
}
