const { default: slugify } = require("slugify")
const carModel = require("../models/carModel")
const orderModel = require("../models/orderModel")
const fs = require('fs')
const braintree = require("braintree");
const dotenv = require('dotenv')
const brandModel = require("../models/carBrand");
const multer  = require('multer')
const path = require('path')
const cloudinary = require('cloudinary').v2;

dotenv.config()

var gateway = new braintree.BraintreeGateway({
    environment: braintree.Environment.Sandbox,
    merchantId: process.env.BRAINTREE_MERCHANT_ID,
    publicKey: process.env.BRAINTREE_PUBLIC_KEY,
    privateKey: process.env.BRAINTREE_PRIVATE_KEY
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Configure Cloudinary
cloudinary.config({
    cloud_name: 'dhxdwhkkp',
    api_key: '924286756233837',
    api_secret: 'h3y4BAC_yz51tzt1dh0pyPcbBXI'
});

// Check if Cloudinary is configured
const isCloudinaryEnabled = true;

console.log('Cloudinary integration enabled for cars');

const uploadToCloudinary = async (filePath, folder = 'carwale/cars') => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            resource_type: 'image',
            transformation: [
                { width: 1200, height: 800, crop: 'limit' },
                { quality: 'auto' },
                { format: 'auto' }
            ]
        });
        return result;
    } catch (error) {
        throw error;
    }
};

const createCar = async (req, res) => {
    try {
        const { name, description, brand, price, fuelType, transmission, engineSize, mileage, safetyrating, warranty, seater, size, fuelTank } = req.body;

        const requiredFields = ['name', 'description', 'brand', 'price', 'fuelType', 'transmission', 'engineSize', 'mileage', 'safetyrating', 'warranty', 'seater', 'size', 'fuelTank'];
        for (let field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).send({ success: false, message: `${field} is Required` });
            }
        }

        // Handle file uploads
        let uploadedFiles = [];
        
        if (req.files && req.files.length > 0) {
            console.log(`Processing ${req.files.length} files for car creation`);
            
            for (const file of req.files) {
                try {
                    if (isCloudinaryEnabled) {
                        console.log(`Uploading ${file.filename} to Cloudinary...`);
                        const cloudinaryResult = await uploadToCloudinary(file.path, 'carwale/cars');
                        uploadedFiles.push(cloudinaryResult.secure_url);
                        console.log(`Successfully uploaded to Cloudinary: ${cloudinaryResult.secure_url}`);
                        
                        // Clean up local file after successful upload
                        try {
                            fs.unlinkSync(file.path);
                        } catch (unlinkError) {
                            console.log('Warning: Could not delete local file:', unlinkError.message);
                        }
                    } else {
                        // Fallback to local storage
                        console.log(`Using local storage for ${file.filename}`);
                        uploadedFiles.push(`/uploads/${file.filename}`);
                    }
                } catch (uploadError) {
                    console.error(`Failed to upload ${file.filename}:`, uploadError);
                    // Fallback to local storage on upload failure
                    uploadedFiles.push(`/uploads/${file.filename}`);
                }
            }
        }

        const slug = slugify(name);

        const car = new carModel({
            name,
            slug,
            description,
            brand,
            productPictures: uploadedFiles,
            price,
            fuelType,
            transmission,
            engineSize,
            mileage,
            safetyrating,
            warranty,
            seater,
            size,
            fuelTank
        });

        await car.save();

        const category = await brandModel.findById(brand);
        category.carInvoleInThisBrand.push(car);
        await category.save();

        res.status(201).send({
            success: true,
            message: 'Car Created Successfully',
            car
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({
            success: false,
            message: "Error in creating Car",
            error: err.message
        });
    }
};

const getDriveFileId = (url) => {
    const regex = /\/d\/([a-zA-Z0-9_-]+)\//;
    const match = url.match(regex);
    return match ? match[1] : null;
};

const getAllCar = async (req, res) => {
    try {
        const cars = await carModel.find({}).populate('brand');

        const updatedCars = cars.map(car => {
            car.productPictures = car.productPictures.map(picture => {
                const fileId = getDriveFileId(picture);
                return fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w1000?authuser=0` : picture;
            });

            if (car.brand && car.brand.brandPictures) {
                const fileId = getDriveFileId(car.brand.brandPictures);
                car.brand.brandPictures = fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w1000?authuser=0` : car.brand.brandPictures;
            }

            return car;
        });

        res.status(200).send({
            success: true,
            totalCar: updatedCars.length,
            message: "All cars",
            cars: updatedCars
        });
    } catch (err) {
        res.status(500).send({
            success: false,
            message: "Error in Getting Car",
            error: err.message
        });
    }
};

const getCarById = async (req, res) => {
    try {
        const car = await carModel.findOne({ slug: req.params.slug }).populate('brand');

        if (car) {
            car.productPictures = car.productPictures.map(picture => {
                const fileId = getDriveFileId(picture);
                return fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w1000?authuser=0` : picture;
            });

            if (car.brand && car.brand.brandPictures) {
                const fileId = getDriveFileId(car.brand.brandPictures);
                car.brand.brandPictures = fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w1000?authuser=0` : car.brand.brandPictures;
            }
        }

        res.status(200).send({
            success: true,
            message: "Car By this Id",
            car
        });
    } catch (err) {
        res.status(500).send({
            success: false,
            message: "Error in Finding Car Id",
            err
        });
    }
}

const deleteCar = async (req,res) => {
    try{
        const carModel_ = await carModel.findById(req.params.pid)
        try{
            for(const x of carModel_.productPictures){
                fs.unlink(path.join(__dirname, '../uploads/',x), (err)=> {
                    if(err){
                        throw err;
                    }
                })
            }
        }catch(e){
            console.log("Delte: " +e)
        }
        await carModel.findByIdAndDelete(req.params.pid)
        res.status(200).send({
            success:true,
            message:"Car Deleted Successfully"
        });
    }catch(err){
        res.status(500).send({
            success:false,
            message:"Error in Deleting Car",
            err
        })
    }
}

const updatecar = async (req,res) => {
    try{
        const {name,description,fuelType,transmission,engineSize,mileage,safetyrating,warranty,seater,size,fuelTank,price} = req.fields

        switch(true){
            case !name : return res.send({message:"Name is required"})
            case !description : return res.send({message:"Description is required"})
            case !price : return res.send({message:"Price is required"})
            case !fuelType : return res.send({message:"FuelType is required"})
            case !transmission : return res.send({message:"Transmission is required"})
            case !engineSize : return res.send({message:"EngineSize is required"})
            case !mileage : return res.send({message:"Mileage is required"})
            case !safetyrating : return res.send({message:"Safetyrating is required"})
            case !warranty : return res.send({message:"Warranty is required"})
            case !seater : return res.send({message:"Seater is required"})
            case !size : return res.send({message:"Size is required"})
            case !fuelTank : return res.send({message:"Fuel Tank is required"})
        }

        const car = await carModel.findByIdAndUpdate(req.params.pid,{...req.fields,slug:slugify(name)},{new:true})

        await car.save()
        res.status(201).send({
            success:true,
            message:'Car Updated Successfully',
            car
        })
    }catch(err){
        console.log(err)
        res.status(500).send({
            success:false,
            message:"Error in Updating Car",
            err
        })
    }
}

const relatedCar = async (req, res) => {
    try {
        const { cid, bid } = req.params;
        const cars = await carModel.find({
            brand: bid,
            _id: { $ne: cid }
        }).populate('brand');

        cars.forEach(car => {
            car.productPictures = car.productPictures.map(picture => {
                const fileId = getDriveFileId(picture);
                return fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w1000?authuser=0` : picture;
            });

            if (car.brand && car.brand.brandPictures) {
                const fileId = getDriveFileId(car.brand.brandPictures);
                car.brand.brandPictures = fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w1000?authuser=0` : car.brand.brandPictures;
            }
        });

        res.status(200).send({
            success: true,
            message: 'Related Cars for this Brand',
            cars
        });
    } catch (err) {
        res.status(400).send({
            success: false,
            message: "Error While Fetching Related Cars",
            err
        });
    }
}

const braintreeTokenController = async(req,res) => {
    try {
        gateway.clientToken.generate({}, function (err, response) {
          if (err) {
            res.status(500).send(err);
          } else {
            res.send(response);
          }
        });
      } catch (error) {
        console.log(error);
      }
}

const brainTreePaymentController = async (req,res) => {
    try {
        const { nonce, cart } = req.body;
        let total = 0;
        cart.map((i) => {
          total += i.price;
        });
        let newTransaction = gateway.transaction.sale(
          {
            amount: total,
            paymentMethodNonce: nonce,
            options: {
              submitForSettlement: true,
            },
          },
          function (error, result) {
            if (result) {
              const order = new orderModel({
                products: cart,
                payment: result,
                buyer: req.user._id,
              }).save();
              res.json({ ok: true });
            } else {
              res.status(500).send(error);
            }
          }
        );
      } catch (error) {
        console.log(error);
      }
}

module.exports = {upload,createCar,getAllCar,getCarById,deleteCar,updatecar,relatedCar,braintreeTokenController,brainTreePaymentController}