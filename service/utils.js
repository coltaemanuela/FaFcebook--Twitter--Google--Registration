var request = require('request-promise');

var config = require('../config/config.json');
var sg = require('sendgrid')(config.sendgrid.key);

module.exports = {

    sendEmail: function(subject, sender_email, email, template, data){
        var request = sg.emptyRequest();
        request.body = {
            subject: subject,
            from: {
            email: sender_email
            },
            personalizations: [
                {
                  to: [{
                    email:  email
                     }],
                  substitutions: data              
                }
            ],
            template_id: template
        };

        request.method = "POST";
        request.path = "/v3/mail/send";

         return sg.API(request).then(function (response) {
             console.log(response);
          }).catch(function(err){console.log(err.response.body.errors);});
   },


    getUserDataResponse: function( user ){
        return {
            user_id: user.getId(),
            username: user.getUsername(),
            profile_image: user.getProfileImage(),
            custom_deleted_at: user.getCustomDeletedAt()
        }
    },

};
