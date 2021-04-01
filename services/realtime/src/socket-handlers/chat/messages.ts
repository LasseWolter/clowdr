import assert from "assert";
import { Socket } from "socket.io";
import { is } from "typescript-is";
import { send } from "../../rabbitmq/chat/messages";
import { Message } from "../../types/chat";

export function onSend(
    _conferenceSlugs: string[],
    _userId: string,
    socketId: string,
    socket: Socket
): (message: any, cb?: () => void) => Promise<void> {
    return async (message, cb) => {
        if (message) {
            try {
                assert(is<Message>(message), "Data does not match expected type.");
                await send(message);
                socket.emit("chat.messages.send.ack", message.sId);
            } catch (e) {
                console.error(`Error processing chat.messages.send (socket: ${socketId}, sId: ${message.sId})`, e);
                try {
                    socket.emit("chat.messages.send.nack", message.sId);
                } catch (e2) {
                    console.error(`Error nacking chat.messages.send (socket: ${socketId}, sId: ${message.sId})`, e);
                }
            }
        }

        cb?.();
    };
}