export interface ImageMetadata {
    id: string;           // Image filename (primary key)
    photographer?: string; // Photographer's name
    date?: string;        // Date of the photo
    caption?: string;     // Photo caption
    status?: string;      // Pass or Reject
    reason?: string;      // Reason for status decision
    metadata: {
        caption?: string;
        date?: string;
        name?: string;
    };
}

export interface MetadataMessage {
    id: string;
    value: string;
}

export interface StatusUpdateMessage {
    id: string;
    date: string;
    update: {
        status: 'Pass' | 'Reject';
        reason: string;
    }
} 