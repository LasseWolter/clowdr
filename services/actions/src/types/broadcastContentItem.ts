type BroadcastContentItemInput = PendingCreation | MP4Input | VonageInput;

interface PendingCreation {
    type: "PendingCreation";
}

interface MP4Input {
    type: "MP4Input";
    s3Url: string;
}

interface VonageInput {
    type: "VonageInput";
}