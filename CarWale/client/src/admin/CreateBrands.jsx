import React, { useEffect, useState } from 'react';
import AdminMenu from './AdminMenu';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Loading from './Loading'
import toast from 'react-hot-toast';

const CreateBrands = () => {
    const [name, setName] = useState('');
    const [brandPicture, setBrandPicture] = useState(null); // Changed to single file
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleImageChange = (e) => {
        const file = e.target.files[0]; // Get only the first file
        setBrandPicture(file);
    };

    const validateForm = () => {
        if (!name.trim()) {
            toast.error('Brand name is required');
            return false;
        }
        if (!brandPicture) { // Changed from array check
            toast.error('Please upload Brand Image');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            return;
        }
        try {
            setLoading(true)
            const formData = new FormData();
            formData.append('name', name);
            formData.append('brandPictures', brandPicture); // Single file with correct field name

            const { data } = await axios.post(`${process.env.REACT_APP_API_URL}/api/brand/create-brand`, formData);

            if (data.success) {
                toast.success('Brand Created Successfully');
                navigate('/dashboard/admin/allbrands');
            }
            else {
                toast.error(data.message);
            }
        } catch (err) {
            console.log(err);
            if (err.response) {
                toast.error(err.response.data.message || 'Error creating brand');
            } else {
                toast.error('Network error. Please try again.');
            }
        } finally {
            setLoading(false)
        }
    };

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    return (
        <div className='container marginStyle'>
            {!loading ? (
                <div className='container-fluid'>
                    <div className='row'>
                        <div className='col-md-3'>
                            <AdminMenu />
                        </div>
                        <div className='col-md-9 my-3'>
                            <form method='post' enctype="multipart/form-data">
                                <h1 className='text-center'>Create Brand</h1>
                                <div className='m-1'>
                                    <div className='mb-3'>
                                        <input
                                            type='text'
                                            value={name}
                                            placeholder='write the brand name'
                                            className='form-control'
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className='mb-3'>
                                        {brandPicture && (
                                            <div className='text-center'>
                                                <img
                                                    src={URL.createObjectURL(brandPicture)}
                                                    alt="brand_preview"
                                                    className='img img-fluid'
                                                    style={{ maxHeight: '200px' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className='mb-3'>
                                        <label className='btn btn-outline-primary col-md-12'>
                                            Upload Brand Image
                                            <input
                                                type='file'
                                                name='brandPictures'
                                                accept='image/*'
                                                onChange={handleImageChange}
                                                hidden
                                            />
                                        </label>
                                    </div>
                                    <div className='mb-3'>
                                        <button className='btn btn-success' onClick={handleSubmit}>
                                            Create Brand
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            ) : <Loading />}
        </div>
    );
};

export default CreateBrands;
