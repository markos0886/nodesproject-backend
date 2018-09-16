# nodesproject-backend

a [Sails v1](https://sailsjs.com) application


### Links

+ [Get started](https://sailsjs.com/get-started)
+ [Sails framework documentation](https://sailsjs.com/documentation)
+ [Version notes / upgrading](https://sailsjs.com/documentation/upgrading)
+ [Deployment tips](https://sailsjs.com/documentation/concepts/deployment)
+ [Community support options](https://sailsjs.com/support)
+ [Professional / enterprise options](https://sailsjs.com/enterprise)


### Version info

This app was originally generated on Fri Sep 14 2018 12:08:55 GMT-0400 (Hora de verano de Cuba) using Sails v1.0.2.

<!-- Internally, Sails used [`sails-generate@1.15.28`](https://github.com/balderdashy/sails-generate/tree/v1.15.28/lib/core-generators/new). -->



* * * * *

## Steps for local installation
Install node.js >=8.9.x (if not installed)
```
Download link for all platforms here: https://nodejs.org/en/download/  
```
Install MongoDB >=3.4.x (if not installed)
```
Download link for all platforms here:   
```
Install sails 
```bash
npm install sails -g
```

Install app dependencies:
```bash
npm install
```

## Start
```
npm run start
```
or, if you have Sails globally:
```
sails lift
```


## Signup and Authentication Process with JWT

Token-free endpoints: 
```
/user/create
/user/login
/user/forgot
/user/reset_password
```  

Token-required endpoints: 
```
/user
/user/change_password 
```

To pass a JWT use `Authorization` header: 
```
Authorization: Bearer <JWT Token>
```


#### `POST /user/create` 
Creates a new user. Requirements for the password: length is 6-24, use letters and digits. 

__request__ 
```json
{
  "email": "email@example.com",
  "password": "abc123",
  "password_confirm": "abc123"
}
```

__response__
```json
{
  "token": "<JWT>"
}
```


#### `POST /user/login` 
__request__ 
```json
{
  "email": "email@example.com",
  "password": "abc123"
}
```

__response__
```json
{
  "token": "<JWT>"
}
```
N.B. Account will be blocked after `5` fails in `2 mins` (configurable in `api/services/UserManager.js`).


#### `POST /user/apikey`
Login using API keys is intended for trusted system services so they can perform API calls between them.
 
__request__ 
```json
{
  "apiKey": "5c67af45-dcde-4c10-98ad-161d05d9084c"
}
```

__response__
```json
{
  "token": "<JWT>"
}
```

#### `GET /user`
Returns basic info about current account. Requires authorization.  
__request__ 
Params not required.

__response__
```json
{
  "id": 1,
  "email": "email@example.com"
}
``` 

#### `POST /user/change_password`
Changes user password. User should be authorized.   

__request__ 
```json
{
  "email": "email@example.com",
  "password": "abc123", 
  "new_password": "xyz321",
  "new_password_confirm": "xyz321"
}
```

__response__
```json
{
  "token": "<JWT>"
}
```
N.B. All old tokens will be invalid after changing password.

#### `POST /user/forgot`
Initiates procedure of password recovery.

__request__ 
```json
{
  "email": "email@example.com"
}
```

__response__
```json
{
  "message": "Check your email"
}
``` 

#### `POST /user/reset_password`
Reset password to a new one with a reset token. Reset token sends to a user after 
`/user/forgot`.   

__request__ 
```json
{
  "email": "email@example.com",
  "reset_token": "<Password Reset Token>",
  "new_password": "xyz321",
  "new_password_confirm": "xyz321"
}
```

__response__
```json
{
  "message": "Done"
}
```


### HTTP codes
All endpoints uses HTTP status codes to notify about execution results  
* `200` ok, reqeust executed successfully;
* `201` created, new user created successfully;
* `400` bad request, usually means wrong params;
* `403` forbidden, for locked accounts;
* `500` server error, something went wrong.

