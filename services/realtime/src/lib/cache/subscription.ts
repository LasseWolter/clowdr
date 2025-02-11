import { gql } from "@apollo/client/core";
import { SubscriptionsDocument } from "../../generated/graphql";
import { testMode } from "../../testMode";
import { Cache } from "./cache";

gql`
    query Subscriptions($chatId: uuid!) {
        chat_Subscription(where: { chatId: { _eq: $chatId } }) {
            chatId
            registrantId
        }
    }
`;

export type Subscriptions = {
    chatId: string;
    registrantIds: string[];
};

const SubscriptionsCache = new Cache<Subscriptions>(
    "caches:Subscriptions",
    async (chatId, testMode_ExpectedValue) => {
        return testMode(
            async (apolloClient) => {
                const response = await apolloClient.query({
                    query: SubscriptionsDocument,
                    variables: {
                        chatId,
                    },
                });

                const result: Subscriptions | undefined = response.data.chat_Subscription
                    ? {
                          chatId,
                          registrantIds: response.data.chat_Subscription.map((x) => x.registrantId),
                      }
                    : undefined;

                return result;
            },
            async () => testMode_ExpectedValue
        );
    },
    JSON.stringify,
    JSON.parse,
    24 * 60 * 60 * 1000,
    5 * 60 * 1000
);

export async function getSubscriptions(
    chatId: string,
    testMode_ExpectedInfo: Subscriptions,
    refetchNow = false
): Promise<Subscriptions | undefined> {
    const info = await SubscriptionsCache.get(chatId, testMode_ExpectedInfo, refetchNow);
    if (!info && !refetchNow) {
        return getSubscriptions(chatId, testMode_ExpectedInfo, true);
    }
    return info;
}

export async function insertSubscription(chatId: string, registrantId: string): Promise<void> {
    await SubscriptionsCache.update(
        chatId,
        (existing) => {
            if (!existing?.registrantIds.includes(registrantId)) {
                return {
                    chatId,
                    registrantIds: existing ? [...existing.registrantIds, registrantId] : [registrantId],
                };
            } else {
                return existing;
            }
        },
        {
            chatId,
            registrantIds: [],
        }
    );
}

export async function deleteSubscription(chatId: string, registrantId: string): Promise<void> {
    await SubscriptionsCache.update(
        chatId,
        (existing) => {
            return {
                chatId,
                registrantIds: existing ? existing.registrantIds.filter((x) => x !== registrantId) : [],
            };
        },
        {
            chatId,
            registrantIds: [registrantId],
        }
    );
}
