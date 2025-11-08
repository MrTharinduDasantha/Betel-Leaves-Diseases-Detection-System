# Betel Leaf Disease Detection and Solution System

A comprehensive web-based platform for identifying betel leaf diseases and providing cultivation guidance. Built with Flask, MongoDB, and Cloudinary, featuring real-time communication and community features.


## Demo

Click the link below to see the demonstration of the Betel Leaf Disease Detection and Solution System.

Link 👉 https://drive.google.com/file/d/1hXE7sjyQ6cHozu543nHzzvixdRxTE6cD/view?usp=sharing 👈


## Features

### Farmer
- Disease Detection: Upload betel leaf images to identify diseases (Bacterial Leaf Spot, Fungal Brown Spot, Dried Leaf, Healthy).
- Cultivation Guides: Access detailed cultivation guides with similar functionality.
- Community Forum: Post questions, share experiences, and interact with other farmers.
- Real-time Chat: Consult with agricultural officers directly.
- Personalized Dashboard: Track activities and notifications.

### Agricultural Officer
- Solution Management: Add/update disease solutions and treatment recommendations.
- Content Creation: Publish cultivation guides with rich text formatting.
- Expert Consultation: Provide real-time advice to farmers via chat.
- Community Moderation: Engage in forum discussions and provide expert insights.

### Authentication & Access Control
- Role-based Access: Separate interfaces for farmers and agricultural officers.
- Secure Registration: Profile-based registration with image upload.
- Session Management: Secure login/logout functionality.


## Technologies Used

### Frontend
- HTML5, CSS3, JavaScript
- Responsive design with modern UI components

### Backend
- Python with Flask web framework
- Flask-SocketIO for real-time features
- MongoDB for database management
- Cloudinary for image storage and management

### Machine Learning
- Convolutional Neural Network (CNN) for image classification
- Google Colab for model training
- Data augmentation techniques

### Development Tools
- Visual Studio Code
- Google Colab for model training
- GitHub for version control


## Installation

Clone the repository and install the required dependencies.
```bash
  git clone https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System.git
  cd Betel-Leaves-Diseases-Detection-System
```
#### Create Virtual Environment (Recommended)
```bash
  python -m venv venv
  venv\Scripts\activate
```
#### Install Dependencies
```bash
  pip install -r requirements.txt
```
#### Environment Variables 
Create a .env file in the root directory with the following variables:
```bash
# Cloudinary credentials
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# MongoDB credentials
MONGO_CONNECTION_STRING=your_mongodb_connection_string

# Flask secret key
SECRET_KEY=your_flask_secret_key
```
#### Run the Application
```bash
python app.py
```
The application will be available at http://localhost:5000

## Usage
1. Registration: Create an account as a Farmer or Agricultural Officer
2. Disease Detection: Upload betel leaf images for automatic disease identification
3. Access Solutions: View recommended treatments for detected diseases
4. Community Engagement: Participate in forums and chat with experts
5. Cultivation Learning: Access and contribute to cultivation guides

## Model Performance
The CNN model achieves the following performance on test data:
- Overall Accuracy: 89%
- Precision: 90% (macro average)
- Recall: 89% (macro average)
- F1-Score: 89% (macro average)

## Detailed Classification Report:
- Bacterial Leaf Disease: 73% precision, 93% recall
- Dried Leaf: 100% precision, 100% recall
- Fungal Brown Spot Disease: 97% precision, 97% recall
- Healthy Leaf: 89% precision, 65% recall

## Database Schema
The application uses MongoDB with the following collections:
- users - User profiles and authentication
- solutions - Disease solutions and treatments
- cultivation_guides - Educational content
- posts - Community forum posts
- messages - Real-time chat messages
- notifications - User notifications
- testimonials - User testimonials

## Real-time Features
- Live chat between farmers and officers
- Real-time notifications
- Instant forum updates
- Live post interactions (likes, comments)

## Contact
For technical support, You can contact me at tharindudasantha2001e@gmail.com.

## Screenshots

![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/f6e4371834d276fc89c93b792c8662f7f985ee26/Img%20-%201.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/f6e4371834d276fc89c93b792c8662f7f985ee26/Img%20-%202.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/f6e4371834d276fc89c93b792c8662f7f985ee26/Img%20-%203.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/f6e4371834d276fc89c93b792c8662f7f985ee26/Img%20-%204.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/f6e4371834d276fc89c93b792c8662f7f985ee26/Img%20-%205.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/f6e4371834d276fc89c93b792c8662f7f985ee26/Img%20-%206.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/f6e4371834d276fc89c93b792c8662f7f985ee26/Img%20-%207.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/f6e4371834d276fc89c93b792c8662f7f985ee26/Img%20-%208.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/f6e4371834d276fc89c93b792c8662f7f985ee26/Img%20-%209.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/cbfdd1f5e83e7a2de98ae10ab0530deca4a4311e/Img%20-%2010.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/cbfdd1f5e83e7a2de98ae10ab0530deca4a4311e/Img%20-%2011.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/cbfdd1f5e83e7a2de98ae10ab0530deca4a4311e/Img%20-%2012.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/f6e4371834d276fc89c93b792c8662f7f985ee26/Img%20-%2013.png)
![image alt](https://github.com/MrTharinduDasantha/Betel-Leaves-Diseases-Detection-System/blob/f6e4371834d276fc89c93b792c8662f7f985ee26/Img%20-%2014.png)

<h4 align="center"> Don't forget to leave a star ⭐️ </h4>

