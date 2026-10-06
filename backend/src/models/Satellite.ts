import mongoose, { Schema, Document } from 'mongoose';
import { ISatellite } from '../shared/types';

export interface ISatelliteDocument extends Omit<ISatellite, 'satelliteId'>, Document {
  satelliteId: string;
}

const SatelliteSchema = new Schema<ISatelliteDocument>(
  {
    satelliteId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    noradId: {
      type: Number,
      required: false,
    },
    intlDesignator: {
      type: String,
      required: false,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['cubesat', 'smallsat', 'medium', 'large', 'simulated'],
      default: 'smallsat',
    },
    operator: {
      type: String,
      required: false,
      trim: true,
    },
    mission: {
      type: String,
      required: false,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'inactive', 'decommissioned', 'simulated'],
      default: 'active',
    },
    launchDate: {
      type: Date,
      required: false,
    },
    dataSource: {
      type: String,
      required: true,
      enum: ['simulator', 'satnogs', 'dataset', 'manual'],
      default: 'simulator',
    },
  },
  {
    timestamps: true,
    collection: 'satellites',
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound / specific indexes
SatelliteSchema.index({ status: 1 });
SatelliteSchema.index({ type: 1 });

export const SatelliteModel = mongoose.models.Satellite || mongoose.model<ISatelliteDocument>('Satellite', SatelliteSchema);
