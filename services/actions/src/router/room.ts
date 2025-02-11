import { json } from "body-parser";
import express, { Request, Response } from "express";
import { assertType } from "typescript-is";
import {
    handleCreateDmRoom,
    handleCreateForItem,
    handleRemoveOldRoomParticipants,
    handleRoomCreated,
} from "../handlers/room";
import { checkEventSecret } from "../middlewares/checkEventSecret";
import { checkJwt } from "../middlewares/checkJwt";
import { checkUserScopes } from "../middlewares/checkScopes";
import { Payload, RoomData } from "../types/hasura/event";

export const router = express.Router();

// Protected routes
router.use(checkEventSecret);

router.post("/created", json(), async (req: Request, res: Response) => {
    try {
        assertType<Payload<RoomData>>(req.body);
    } catch (e) {
        console.error(`${req.originalUrl}: received incorrect payload`, e);
        res.status(500).json("Unexpected payload");
        return;
    }
    try {
        await handleRoomCreated(req.body);
    } catch (e) {
        console.error("Failure while handling room created", e);
        res.status(500).json("Failure while handling event");
        return;
    }
    res.status(200).json("OK");
});

router.post("/removeOldParticipants", json(), async (_req: Request, res: Response) => {
    try {
        await handleRemoveOldRoomParticipants();
    } catch (err) {
        console.error("Failure while handling remove old room participants", err);
        res.status(500).json("Failure while handling event");
        return;
    }
    res.status(200).json("OK");
});

router.use(json());
router.use(checkJwt);
router.use(checkUserScopes);

router.post("/createDm", async (req: Request, res: Response<CreateRoomDmOutput>) => {
    try {
        const params = req.body.input;
        assertType<createRoomDmArgs>(params);
        const result = await handleCreateDmRoom(params, req.body.session_variables["x-hasura-user-id"]);
        return res.status(200).json(result);
    } catch (e) {
        console.error(`${req.originalUrl}: invalid request`, req.body, e);
        return res.status(200).json({
            message: "Invalid request",
        });
    }
});

router.post("/createForItem", async (req: Request, res: Response<CreateContentGroupRoomOutput>) => {
    try {
        const params = req.body.input;
        assertType<createContentGroupRoomArgs>(params);
        const result = await handleCreateForItem(params, req.body.session_variables["x-hasura-user-id"]);
        return res.status(200).json(result);
    } catch (e) {
        console.error(`${req.originalUrl}: invalid request`, req.body, e);
        return res.status(200).json({
            message: "Invalid request",
        });
    }
});
