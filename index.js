//import required module
const express = require('express');
const app = express();
const bodyParser = require('body-parser'); //post body handler
const Sequelize = require('sequelize'); //Database ORM
const { check, validationResult } = require('express-validator/check'); //form validation
const { matchedData, sanitize } = require('express-validator/filter'); //sanitize form params
const multer  = require('multer'); //multipar form-data
const path = require('path');
const crypto = require('crypto');

//Set body parser for HTTP post operation
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

//set static assets to public directory
app.use(express.static('public'));
const uploadDir = '/img/';
const storage = multer.diskStorage({
    destination: "./public"+uploadDir,
    filename: function (req, file, cb) {
      crypto.pseudoRandomBytes(16, function (err, raw) {
        if (err) return cb(err)  

        cb(null, raw.toString('hex') + path.extname(file.originalname))
      })
    }
})

const upload = multer({storage: storage, dest: uploadDir });

//Set app config
const port = 3000;
const baseUrl = 'http://localhost:'+port;

//Connect to database
const sequelize = new Sequelize('bookstore', 'root', '', {
    host: 'localhost',
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        idle: 10000
    }
});

//Define models
const book = sequelize.define('book', {
    'id': {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    'isbn': Sequelize.STRING,
    'name': Sequelize.STRING,
    'year': Sequelize.STRING,
    'author': Sequelize.STRING,
    'description': Sequelize.TEXT,
    'image': {
        type: Sequelize.STRING,
        //Set custom getter for book image using URL
        get(){
            const image = this.getDataValue('image');
            return uploadDir+image;
        }
    },
    'createdAt': {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    },    
    'updatedAt': {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    },   
    
}, {
    //prevent sequelize transform table name into plural
    freezeTableName: true,
})

/**
 * Set Routes for CRUD
 */

//get all books
app.get('/book/', (req, res) => {
    book.findAll().then(book => {
        res.json(book)
    })
})

//get book by isbn
app.get('/book/:isbn', (req, res) => {
    book.findOne({where: {isbn: req.params.isbn}}).then(book => {
        res.json(book)
    })
})

//Insert operation
app.post('/book/', [
    //File upload (karena pakai multer, tempatkan di posisi pertama agar membaca multipar form-data)
    upload.single('image'),

    //Set form validation rule
    check('isbn')
        .isLength({ min: 5 })
        .isNumeric()
        .custom(value => {
            return book.findOne({where: {isbn: value}}).then(b => {
                if(b){
                    throw new Error('ISBN already in use');
                }            
            })
        }
    ),
    check('name')
        .isLength({min: 2}),
    check('year')
        .isLength({min: 4, max: 4})
        .isNumeric(),
    check('author')
        .isLength({min: 2}),
    check('description')
     .isLength({min: 10})

],(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.mapped() });
    }

    book.create({
        name: req.body.name,
        isbn: req.body.isbn,
        year: req.body.year,
        author: req.body.author,
        description: req.body.description,
        image: req.file === undefined ? "" : req.file.filename
    }).then(newBook => {
        res.json({
            "status":"success",
            "message":"Book added",
            "data": newBook
        })
    })
})

//Update operation
app.put('/book/', [
    //File upload (karena pakai multer, tempatkan di posisi pertama agar membaca multipar form-data)
    upload.single('image'),

    //Set form validation rule
    check('isbn')
        .isLength({ min: 5 })
        .isNumeric()
        .custom(value => {
            return book.findOne({where: {isbn: value}}).then(b => {
                if(!b){
                    throw new Error('ISBN not found');
                }            
            })
        }
    ),
    check('name')
        .isLength({min: 2}),
    check('year')
        .isLength({min: 4, max: 4})
        .isNumeric(),
    check('author')
        .isLength({min: 2}),
    check('description')
     .isLength({min: 10})

],(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.mapped() });
    }
    const update = {
        name: req.body.name,
        isbn: req.body.isbn,
        year: req.body.year,
        author: req.body.author,
        description: req.body.description,
        image: req.file === undefined ? "" : req.file.filename
    }
    book.update(update,{where: {isbn: req.body.isbn}})
        .then(affectedRow => {
            return book.findOne({where: {isbn: req.body.isbn}})      
        })
        .then(b => {
            res.json({
                "status": "success",
                "message": "Book updated",
                "data": b
            })
        })
})

app.delete('/book/:isbn',[
    //Set form validation rule
    check('isbn')
        .isLength({ min: 5 })
        .isNumeric()
        .custom(value => {
            return book.findOne({where: {isbn: value}}).then(b => {
                if(!b){
                    throw new Error('ISBN not found');
                }            
            })
        }
    ),
], (req, res) => {
    book.destroy({where: {isbn: req.params.isbn}})
        .then(affectedRow => {
            if(affectedRow){
                return {
                    "status":"success",
                    "message": "Book deleted",
                    "data": null
                } 
            }

            return {
                "status":"error",
                "message": "Failed",
                "data": null
            } 
                
        })
        .then(r => {
            res.json(r)
        })
})


app.listen(port, () => console.log("book-rest-api run on "+baseUrl ))