var	mailer = require('nodemailer'),
	smtp = mailer.createTransport("SMTP",{
		host: 'mail.email.co.uk',
		auth: {
			user: "jon@email.co.uk",
			pass: ""
		}
	});
exports.sendEmail = function(to, from, bcc, subject, message) {
	smtp.sendMail({
			from: from,
			to: to,
			bcc: bcc,
			subject: subject,
			html: message,
			generateTextFromHTML: true
		},
		function (error, response) {
			if (error) {
				console.log(error);
			} else {
				console.log("Message sent: " + response.message);
			}
	});
};
