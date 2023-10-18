import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useCookiesStore } from './cookiesStore';
import { useRouter } from 'vue-router';
import { Socket, io } from "socket.io-client";
import { useMainStore } from './mainStore';

export class Event<T>
{
    private listeners = [] as any[];
    constructor() { }
    subscribe(callback: (arg:T) => void) { this.listeners.push(callback); }
    trigger(arg: T) { this.listeners.forEach(x => x(arg)); }
}

export const useNetworkStore = defineStore(
{
    id: "networkStore",
    state: () => 
    ( 
        {
            cookiesStore: useCookiesStore(),
            socket: undefined as undefined|Socket,
            mainStore: useMainStore(),
            isSocketConnected: false,
            onSocketEvent: new Event<{eventName:string, arg: any}>()
        }
    ),
    getters:
    {

    },
    actions:
    {
        /**
         * Connect websocket to the server using the current cookies' token and username. Will redirect if this fails.
         * @returns 
         */
        connectSocket()
        {
            if (this.socket != undefined) return;
            let token = this.cookiesStore.getCookie("token");
            let username = this.cookiesStore.getCookie("username");
            let onConnectionFailed = (err:Error) => 
            {
                alert(err.message);
                this.mainStore.logout(); // clear all cookies and redirect to auth screen
            };

            this.socket = io(
            {
                auth:
                {
                    token: token,
                    username: username
                }
            });

            this.socket.on('connect_error', err => onConnectionFailed(err))
            this.socket.on('disconnect', () =>{ this.isSocketConnected = false; });
            this.socket.on('connect', () =>{ this.isSocketConnected = true; });
            this.socket.onAny((eventName, arg) => 
            {
                this.onSocketEvent.trigger({eventName: eventName, arg: arg});
            });
        },
        async authPost(url:string, body:any, noRefresh=false)
        {
            let self = this;
            let queryURL = `${url}`;

            return fetch(queryURL,
            {
                method: "POST", headers: 
                { 
                    'Content-Type': 'application/json',
                    "authorization": self.cookiesStore.getCookie("token") ?? "",
                    "auth-username": self.cookiesStore.getCookie("username") ?? ""
                },
                body: JSON.stringify(body)
            })
            .then(response => 
            {
                if (response.status == 401 && noRefresh == false) self.mainStore.logout();
                else if (!response.ok) { return Promise.reject(response); }
                else return response.json();
            });
        },
        async authGet(url:string)
        {
            try
            {
                let self = this;
                let queryURL = `${url}`;

                let response = await fetch(queryURL, 
                {
                    method: "GET",
                    headers: 
                    {
                        "authorization": self.cookiesStore.getCookie("token") ?? "",
                        "auth-username": self.cookiesStore.getCookie("username") ?? ""
                    }
                });

                if (response.status == 401) this.mainStore.logout();
                else if (!response.ok) return Promise.reject(response);
                else return await response.json();
            }
            catch(ex) { console.log(ex); }
        },
    }
});