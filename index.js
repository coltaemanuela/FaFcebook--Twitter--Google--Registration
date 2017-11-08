var express = require('express');
var moment = require('moment');
var expressJWT = require('express-jwt');
var Twitter = require('twitter');
var util = require('util');
var Fb = require('fb');
var plus = require('googleapis').plus('v1');
var router  = express.Router();
var config = require('../config/config.json');
var utils= require('../service/utils');
var jwtDecode = require('jwt-decode');
var sg = require('sendgrid')(config.sendgrid.key);
var rs = require('../service/apiResponse.js');
var sequelize_conn = require('../models').sequelize_conn;
var request = require("request");


router.get('/',function(req,res){
	res.send('Register page');
})


router.post('/social-register', function(req, res, next) {

	//old if( !req.body.type || !req.body.token || req.body.user_id ) return res.json( rs.errorCode('miss_req_params') );

    req.checkBody('email').optional();
    req.checkBody('email', 'Email is not valid').optional({checkFalsy: true }).isEmail();
    req.checkBody('type').notEmpty();
    req.checkBody('token').notEmpty();
    if( parseInt(req.body.type) === 2 || parseInt(req.body.type) === 3 ) req.checkBody('user_id').notEmpty();

    if( req.validationErrors() ) return res.json( rs.customError( req.validationErrors().join('; ') ) );
	
    var token = req.body.token;

	switch ( parseInt(req.body.type) ) {

		case 21: // google+ authentication 	// @token = { "general": "", "secret": "" }
			
            plus.people.get({ auth: config.social.gooogle.api_key, userId: req.body.user_id }, function (err, google_response) {

                if( err ) return res.json( rs.customError( JSON.stringify( err ) ));

                var local_email = google_response.email ? google_response.email : req.body.email;

                if( !local_email ) return res.json( rs.errorCode( 'email_is_empty' ));
                
                var new_go_user_data = {};

                User.findOne({ where: { email: local_email } })
                .then(function( existing_thumb_go_user ){

                    if( existing_thumb_go_user && existing_thumb_go_user.getType() === 2 && existing_thumb_go_user.isBlocked() ) throw new Error('blocked_user');

                    if( existing_thumb_go_user ) throw new Error('social_user_existing');

                    return User.create({
                        username: local_email.split('@')[0],
                        email : local_email,
                        social_id : google_response.id,
                        fullname: google_response.displayName ? google_response.displayName : '',
                        social_token: JSON.stringify(req.body.token), // this is object, I need to stringify it
                        type : 2
                    })

                })
                .then(function(new_go_user){
                    new_go_user_data = new_go_user;

                    return UserOnlineStatus.build({
                        user_id: new_go_user_data.getId(),
                        status: new Date()
                    }).save();
                })
                .then(function(){

                    var data = {
                        username: new_go_user_data.username,
                        link: config.emails.new_account_link,
                        email: new_go_user_data.email
                    };
                
                    utils.sendEmail(config.emails.new_account_subject, config.emails.new_account_email,new_go_user_data.email,config.emails.new_account_template,data);					
                    res.json( rs.successWithJwt( new_go_user_data.getJwt() )); next();
                })
                .catch(function(err){
                    res.json( rs.errorCode(err.message) );
                });
            });
			break;
				
		case 3: // twitter 

            var client = new Twitter({
				consumer_key: config.social.twitter.consumer_key,
				consumer_secret: config.social.twitter.consumer_secret,
				access_token_key: token.general, 
				access_token_secret: token.secret
			});

			client.get( 'users/show.json', { id: req.body.user_id }, function( error, tw_user_response, response){

				if( error ) return res.json( rs.customError( JSON.stringify( error ) ));

                var local_email = tw_user_response.email ? tw_user_response.email : req.body.email;

                if( !local_email ) return res.json( rs.errorCode( 'email_is_empty' ));

                new_tw_user_data= {};

                User.findOne({ where: { email: local_email } })
                .then(function( existing_user ){
                  
                    if( existing_user ) throw new Error('social_user_existing');

                    return User.create({
                        username: tw_user_response.screen_name ? tw_user_response.screen_name : local_email.split('@')[0],
                        email: local_email,
                        social_id: tw_user_response.id,
                        fullname: tw_user_response.name ? tw_user_response.name : '',
                        social_token: JSON.stringify(req.body.token),   // this is object, I need to stringify it
                        type : 3
                    })

                })
                .then(function(new_tw_user){
                    new_tw_user_data = new_tw_user;

                    return UserOnlineStatus.build({
                        user_id: new_tw_user_data.getId(),
                        status: new Date()
                    }).save();
                })
                .then(function(){
                    return res.json( rs.successWithJwt( new_tw_user_data.getJwt() ));
				}).catch(function(err){
                    res.json( rs.errorCode(err.message) );
				});

			});

			break;
	
		default:
			break;
	}
});

router.post('/forgot-password', function(req, res) {

    req.checkBody('email').
    req.checkBody('email', 'Email is not valid').isEmail();

    if( req.validationErrors() ) return res.json( rs.customError( req.validationErrors().join('; ') ) );

    var forgot_hash;

	User.findOne({ where:{ email: req.body.email, custom_deleted_at: { $eq: null } } }).then(function( existing_user ){ 

		if(!existing_user) return res.json( rs.errorCode('user_not_found') );

        forgot_hash = existing_user.getForgotHash();

        var data = {
            username: 	existing_user.username,
            link:		config.emails.forgot_password_link + '?h=' + forgot_hash,
            email:		req.body.email
        };			
        
        utils.sendEmail(config.emails.forgot_password_subject, config.emails.forgot_password_email, existing_user.email, config.emails.forgot_pasword_template, data)
        .then(function(){		
            User.update( { forgot_token: forgot_hash }, { where:{ id: existing_user.id } } );
            return res.json( rs.success({ status: "done" }) );				
        }).catch(function( err ){
            return res.json( rs.errorCode(err.message) );
        });
	});
});

router.post('/reset-password', function(req, res, next) {

    req.checkBody('h').notEmpty();
    req.checkBody('password').notEmpty();
    req.checkBody('password_confirmation').notEmpty();

    if( req.validationErrors() ) return res.json( rs.customError( req.validationErrors().join('; ') ) );

	if( req.body.password !== req.body.password_confirmation ) return res.json( rs.customError("password_do_not_match") );

    User.findOne({ where:{ forgot_token: req.body.h } }).then( user => {
        user.setPassword( req.body.password );
        user.save().then(function( updated_user ){
            return res.json( rs.success({ status: "done" }) );
        });
    });
});

router.get('/get-users', function( req, res, next ) {

    l( req.query.q );
    if( req.query.q.length < 2 ) return res.json( rs.errorCode('minim_string_length') );

    User.findAll({ 
        where:{
            $or: [
                { username: { $like: req.query.q } }, 
                { fullname: { $like: req.query.q } },
                { bio: { $like: req.query.q } }
            ]
        },
    })
    .then(function( users ){

        var response_data = users.map(function(user){
            return utils.getUserDataResponse(user)

        });
        
        res.json(rs.success({ users: response_data }));
    })
});

router.post('/report-abuse', function(req, res, next) {
  
      req.checkBody('email').notEmpty();
      req.checkBody('message').notEmpty();
  
      if( req.validationErrors() ) return res.json( rs.customError( req.validationErrors().join('; ') ) );
  
      var user_email = req.body.email;
      var subject = "Report Abuse";
  
      var data = {
          subject: subject,
          email: 	user_email,
          message: req.body.message
      };
  
      utils.sendEmail( subject, config.emails.contact_email,config.emails.admin_email,config.emails.contact_template, data)
      .then(function(){
          res.json( rs.success({ email: user_email,subject: subject, message: req.body.message}) );
          next();
      });
  });

module.exports = router;
