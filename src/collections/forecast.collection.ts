import { Schema, model } from "mongoose";

const forecastEventSchema = new Schema(
    {
        date: { type: String, required: true },
        time: { type: String, required: true },
        value: { type: Number, required: true },
        flag: { type: String, required: false },
    },
    { _id: false }
);

const forecastSchema = new Schema(
    {
        basin: { type: String, required: true }, // locationId from XML (EA001, EA004, etc.)
        strategy: { type: String, enum: ["smc", "ecmwf", "wrf"], required: true },
        model: { type: String, required: false },
        jobType: { type: String, enum: ["forecast", "historical"], required: true },
        parameterId: { type: String, required: false }, // e.g., "Discharge_forecast"
        units: { type: String, required: false }, // e.g., "m3/s"
        events: { type: [forecastEventSchema], required: true },
        startDate: { type: Date, required: false },
        endDate: { type: Date, required: false },
        jobId: { type: String, required: false },
        metadata: { type: Object, required: false },
        simulationDate: { type: String, required: false },
    },
    { timestamps: true }
);

// Indexes for efficient queries
forecastSchema.index({ createdAt: -1 });
forecastSchema.index({ basin: 1, createdAt: -1 });
forecastSchema.index({ strategy: 1, createdAt: -1 });
forecastSchema.index({ jobType: 1, createdAt: -1 });
forecastSchema.index({ basin: 1, strategy: 1, jobType: 1, createdAt: -1 });

const Forecast = model("Forecast", forecastSchema);

export default Forecast;
