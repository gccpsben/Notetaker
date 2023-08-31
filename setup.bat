@echo OFF
echo You are about to use a web project template with the following stacks:
echo(
echo FRONTEND:
echo -^> Vue-3
echo -^> Vue-Typescript
echo -^> Vue-Router
echo -^> Pinia
echo -^> LESS
echo(
echo BACKEND:
echo -^> Express+Minify
echo -^> Typescript
echo -^> Axios
echo -^> Dotenv+Expand
echo -^> Chalk
echo(
echo Notice there are no database setup provided in this script.
set /p=Continue?

cls
echo First, let's create our server.
echo The following modules will be installed:
echo(
echo tsc-watch (dev dep)
echo typescript (dev dep)
echo @types/node (dev dep)
echo log-to-file
echo axios
echo chalk@^4.1.2
echo dotenv
echo dotenv-expand
echo express
echo express-minify
echo npm-add-script (global dep)

set /p=Hit ENTER to continue...

cd ./server
call npm init -y --name=server

cls
echo Installing tsc-watch...
call npm install tsc-watch --save-dev

cls
echo Installing typescript...
call npm install -D typescript

cls
echo Installing @types/node...
call npm i --save-dev @types/node

cls
echo Instlling log-to-file...
call npm install log-to-file

cls
echo Installing axios...
call npm install axios

cls
echo Installing chalk@^4.1.2...
call npm install chalk@^4.1.2

cls
echo Installing dotenv...
call npm install dotenv

cls
echo Installing dotenv-expand...
call npm install dotenv-expand

cls
echo Installing express...
call npm install express

cls
echo Installing express-minify...
call npm install express-minify

cls
echo Installing npm-add-script...
call npm install -g npm-add-script

cls
echo All server modules installed...
echo Adding server scripts...

call npmAddScript -f -k watch_server -v "tsc-watch -p \"./tsconfig.json\" --onSuccess \"node server_build/server.js\""

echo Remember to add SSL cert to ./server/ssl
set /p=All server setup done...

cls
cd ../frontend
echo Installing frontend modules...
@REM call npm create vite@latest . --template vue-ts
call npm i
echo(
echo Installing less...
call npm add -D less

cls
set "PORT=5173"
set /p PORT=Please enter a frontend port to use during development (vite's default 5173): 
call npmAddScript -f -k dev -v "vite --port %PORT%"

cls
echo All installation done... Starting dev env...

cd ../
call startdev.bat