const { default: slugify } = require('slugify');
const brandModel = require('../models/carBrand');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

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


const uploadToCloudinary = async (filePath, folder = 'carwale/brands') => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            resource_type: 'image',
            transformation: [
                { width: 800, height: 600, crop: 'limit' },
                { quality: 'auto' },
                { format: 'auto' }
            ]
        });
        return result;
    } catch (error) {
        throw error;
    }
};

const createBrand = async (req, res) => {
    try {
        const { name } = req.body;

        console.log('Request body:', req.body);
        console.log('Request file:', req.file);

        if (!name) {
            return res.status(400).send({
                success: false,
                message: 'Brand Name is Required'
            });
        }

        if (!req.file) {
            return res.status(400).send({
                success: false,
                message: 'Brand Image is Required'
            });
        }

        const brandPictures = req.file.path;

        const existCategory = await brandModel.findOne({ name });

        if (existCategory) {
            return res.status(400).send({
                success: false,
                message: 'Brand Name Already Exists',
            });
        }

        let imageUrl;

        try {
            console.log('Uploading to Cloudinary...');
            const cloudinaryResponse = await uploadToCloudinary(brandPictures, 'carwale/brands');
            imageUrl = cloudinaryResponse.secure_url;
            // Delete local file after successful upload to Cloudinary
            fs.unlinkSync(brandPictures);
            console.log('Successfully uploaded to Cloudinary:', cloudinaryResponse.public_id);
        } catch (cloudinaryError) {
            console.log('Cloudinary upload failed, using local storage:', cloudinaryError.message);
        }

        const brand = new brandModel({
            name,
            brandPictures: imageUrl,
            slug: slugify(name)
        });
        await brand.save();

        res.status(201).send({
            success: true,
            message: 'Brand Created Successfully',
            brand,
        });
    } catch (err) {
        console.log('Error creating brand:', err);
        res.status(500).send({
            success: false,
            message: 'Error in creating Brand',
            error: err.message,
        });
    }
};

const getDriveFileId = (url) => {
    const regex = /\/d\/([a-zA-Z0-9_-]+)\//;
    const match = url.match(regex);
    return match ? match[1] : null;
};

const getCloudinaryPublicId = (url) => {
    // Extract public_id from Cloudinary URL
    const regex = /\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp)$/i;
    const match = url.match(regex);
    return match ? match[1] : null;
};

const getBrand = async (req, res) => {
    try {
        const brands = await brandModel.find({}).populate('carInvoleInThisBrand');

        const updatedBrands = brands.map(brand => {
            // Check if it's a Google Drive URL (for backwards compatibility)
            if (brand.brandPictures && brand.brandPictures.includes('drive.google.com')) {
                const fileId = getDriveFileId(brand.brandPictures);
                if (fileId) {
                    brand.brandPictures = `https://lh3.googleusercontent.com/d/${fileId}=w1000?authuser=0`;
                }
            }
            // Cloudinary URLs are already optimized and ready to use
            // Local URLs will be served by the static middleware
            return brand;
        });

        res.status(200).send({
            success: true,
            totalBrand: updatedBrands.length,
            message: "All Brands",
            brands: updatedBrands
        });
    } catch (err) {
        console.log('Error getting brands:', err);
        res.status(500).send({
            success: false,
            message: "Error in Getting Brand",
            error: err.message
        });
    }
};

const getBrandById = async (req, res) => {
    try {
        const brand = await brandModel.findOne({ slug: req.params.slug }).populate('carInvoleInThisBrand');

        if (!brand) {
            return res.status(404).send({
                success: false,
                message: "Brand not found"
            });
        }

        const convertDriveUrl = (url) => {
            const fileId = getDriveFileId(url);
            return fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w1000?authuser=0` : url;
        };

        brand.brandPictures = convertDriveUrl(brand.brandPictures);

        brand.carInvoleInThisBrand.forEach(car => {
            car.productPictures = car.productPictures.map(picture => convertDriveUrl(picture));
        });

        res.status(200).send({
            success: true,
            message: "Brand By this Id",
            brand
        });
    } catch (err) {
        res.status(500).send({
            success: false,
            message: "Error in Finding Brand Id",
            err
        });
    }
};

const updateBrand = async (req, res) => {
    try {
        const { name } = req.body
        const { id } = req.params

        const brand = await brandModel.findByIdAndUpdate(id, { name, slug: slugify(name) }, { new: true })
        res.status(200).send({
            success: true,
            message: "Brand Updated Successfully",
            brand
        })
    } catch (err) {
        res.status(500).send({
            success: false,
            message: "Error in Updating Brand",
            err
        })
    }
}

const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params

        // Get the brand to delete to access its image
        const brand = await brandModel.findById(id);
        if (brand && brand.brandPictures) {
            try {
                // If it's a Cloudinary URL, delete from Cloudinary
                if (brand.brandPictures.includes('cloudinary.com')) {
                    const publicId = getCloudinaryPublicId(brand.brandPictures);
                    if (publicId && isCloudinaryEnabled) {
                        await cloudinary.uploader.destroy(publicId);
                        console.log('Deleted from Cloudinary:', publicId);
                    }
                }
                // If it's a local file, delete it
                else if (brand.brandPictures.includes('localhost')) {
                    const filename = brand.brandPictures.split('/').pop();
                    const filePath = path.join(__dirname, '../uploads/', filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log('Deleted local file:', filename);
                    }
                }
                // For Google Drive files, you could implement deletion here if needed
            } catch (e) {
                console.log("Error deleting file: " + e);
            }
        }

        await brandModel.findByIdAndDelete(id)
        res.status(200).send({
            success: true,
            message: "Brand Deleted Successfully"
        })
    } catch (err) {
        res.status(500).send({
            success: false,
            message: "Error in Deleting Brand",
            err
        })
    }
}

module.exports = { getBrand, getBrandById, createBrand, upload, updateBrand, deleteBrand }