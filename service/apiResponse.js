module.exports = {
    errors: {
        'internal_error' : {
            code    : 501,
            msg     : 'There was an internal error.'
        },
        'invalid_token' : {
            code    : 502,
            msg     : 'Invalid Token.'
        },
        'miss_req_params' : {
            code    : 503,
            msg     : 'Required params are missing.'
        },
        'user_not_found' : {
            code    : 504,
            msg     : 'Email or password are wrong.'
        },
        'user_existing' : {
            code    : 505,
            msg     : 'Existing user.'
        },
        'social_user_existing' : {
            code    : 506,
            msg     : 'Existing social user.'
        },
        'minim_string_length' : {
            code    : 507,
            msg     : 'The text is too short for search.'
        },
       
        'password_do_not_match' : {
            code    : 510,
            msg     : 'The passwords do not match.'
        },
         'already_reported' : {
            code    : 511,
            msg     : 'You already reported this entity'
        },
       
        'email_is_empty' : {
            code    : 513,
            msg     : 'Email is empty'
        }       
    },

    send : function( status, data ){

        return {
            status	: status,
            data	: data,
            jwt : "" 
        }

    },

    customError : function( msg ){
        
        var status = {
            code    : 500,
            msg     : msg
        }

        return this.send( status, null );
    },

    success : function( data ){
        
        var status = {
            code    : 200,
            msg     : null
        }

        return this.send( status, data );
    },

    successWithJwt: function(jwt){
        return {
            status	: { code: 200, msg: null},
            data	: '',
            jwt     : jwt
        }
    },

    errorCode : function( id ){
        
        return this.errors[id] ? this.send( this.errors[id], null ) : this.customError(id);

    }

};