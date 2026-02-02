// SUBLYM Backend - AWS Rekognition Service

import { 
  RekognitionClient, 
  CompareFacesCommand,
  DetectFacesCommand,
  QualityFilter,
} from '@aws-sdk/client-rekognition';
import * as fs from 'fs/promises';
import { prisma } from '../db';

let rekognitionClient: RekognitionClient | null = null;

// ============================================
// GET REKOGNITION CLIENT
// ============================================

function getClient(): RekognitionClient {
  if (rekognitionClient) {
    return rekognitionClient;
  }
  
  rekognitionClient = new RekognitionClient({
    region: process.env.AWS_REGION || 'eu-west-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  
  return rekognitionClient;
}

// ============================================
// VERIFY PHOTOS
// ============================================

interface VerifyResult {
  valid: boolean;
  invalidPhotos: number[];
  message: string;
  qualityScores?: number[];
}

export async function verifyPhotosWithRekognition(photoPaths: string[]): Promise<VerifyResult> {
  const client = getClient();
  
  if (photoPaths.length < 2) {
    return { 
      valid: true, 
      invalidPhotos: [], 
      message: 'OK',
    };
  }
  
  // Get similarity threshold from config
  const thresholdConfig = await prisma.config.findUnique({
    where: { key: 'rekognition_threshold' },
  });
  const similarityThreshold = thresholdConfig ? parseFloat(thresholdConfig.value) : 80;
  
  const qualityMinConfig = await prisma.config.findUnique({
    where: { key: 'rekognition_quality_min' },
  });
  const qualityMin = qualityMinConfig ? parseFloat(qualityMinConfig.value) : 80;
  
  const invalidPhotos: number[] = [];
  const qualityScores: number[] = [];
  
  try {
    // Read reference photo (first photo)
    const referencePhoto = await fs.readFile(photoPaths[0]);
    
    // First, check quality of reference photo
    const refQuality = await checkPhotoQuality(client, referencePhoto);
    qualityScores.push(refQuality);
    
    if (refQuality < qualityMin) {
      return {
        valid: false,
        invalidPhotos: [0],
        message: 'Your first photo has low quality. Please upload a clearer photo with your face well visible.',
        qualityScores,
      };
    }
    
    // Compare each photo to reference
    for (let i = 1; i < photoPaths.length; i++) {
      const targetPhoto = await fs.readFile(photoPaths[i]);
      
      // Check quality
      const quality = await checkPhotoQuality(client, targetPhoto);
      qualityScores.push(quality);
      
      if (quality < qualityMin) {
        invalidPhotos.push(i);
        continue;
      }
      
      // Compare faces
      try {
        const command = new CompareFacesCommand({
          SourceImage: { Bytes: referencePhoto },
          TargetImage: { Bytes: targetPhoto },
          SimilarityThreshold: similarityThreshold,
          QualityFilter: 'AUTO',
        });
        
        const response = await client.send(command);
        
        if (!response.FaceMatches || response.FaceMatches.length === 0) {
          invalidPhotos.push(i);
        }
      } catch (error: any) {
        // No face detected or other error
        console.error(`Face comparison error for photo ${i}:`, error.message);
        invalidPhotos.push(i);
      }
    }
    
    if (invalidPhotos.length > 0) {
      return {
        valid: false,
        invalidPhotos,
        message: "You were not identified in one or more photos. Please retry with different photos.",
        qualityScores,
      };
    }
    
    return {
      valid: true,
      invalidPhotos: [],
      message: 'OK',
      qualityScores,
    };
  } catch (error: any) {
    console.error('Rekognition error:', error);
    
    // Handle specific errors
    if (error.name === 'InvalidParameterException') {
      return {
        valid: false,
        invalidPhotos: [0],
        message: 'No face detected in your photos. Please ensure your face is clearly visible.',
      };
    }
    
    // Service unavailable - retry logic
    if (error.name === 'ThrottlingException' || error.name === 'ProvisionedThroughputExceededException') {
      return {
        valid: false,
        invalidPhotos: [],
        message: 'Service temporarily unavailable. Please try again in a moment.',
      };
    }
    
    throw error;
  }
}

// ============================================
// CHECK PHOTO QUALITY
// ============================================

async function checkPhotoQuality(client: RekognitionClient, imageBytes: Buffer): Promise<number> {
  try {
    const command = new DetectFacesCommand({
      Image: { Bytes: imageBytes },
      Attributes: ['QUALITY'],
    });
    
    const response = await client.send(command);
    
    if (!response.FaceDetails || response.FaceDetails.length === 0) {
      return 0; // No face detected
    }
    
    // Get quality from first (most prominent) face
    const face = response.FaceDetails[0];
    const quality = face.Quality;
    
    if (!quality) {
      return 50; // Default if quality not available
    }
    
    // Average brightness and sharpness
    const brightness = quality.Brightness || 50;
    const sharpness = quality.Sharpness || 50;
    
    return (brightness + sharpness) / 2;
  } catch (error) {
    console.error('Quality check error:', error);
    return 50; // Default on error
  }
}

// ============================================
// SINGLE FACE CHECK
// ============================================

export async function hasSingleFace(imageBytes: Buffer): Promise<boolean> {
  const client = getClient();
  
  try {
    const command = new DetectFacesCommand({
      Image: { Bytes: imageBytes },
    });
    
    const response = await client.send(command);
    
    return response.FaceDetails?.length === 1;
  } catch {
    return false;
  }
}
