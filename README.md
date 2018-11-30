# fake-chokidar

a solution for [Chokidar](https://github.com/paulmillr/chokidar) over VirtualBox
shared folders, mainly for projects using [Webpack](http://webpack.github.io/)


## Why?

There are many Windows/Mac developers that use a virtual machine for local
builds, using a VirtualBox shared folder to access the source code on the host
machine.

That's often also the case if you use Docker (ie. boot2docker / docker-machine).

Tools like Webpack can be configured to listen for changes in the source code
so that it reacts by processing the changed files again. Under the hood these
tools usually use [Chokidar](https://github.com/paulmillr/chokidar).

The combination between Chokidar and VirtualBox shared folders is a bad one,
because VirtualBox does not pass file change events between host and guest and
it appears that the VirtualBox developers have no intention to change that.

This means that Webpack and similar tools won't react on file changes in the
shared folder, breaking this extremely useful feature.

It's very hard to solve the problem at O/S level, so **fake-chokidar** solves
the problem on a higher level.


## How does this work?

The principle and implementation is rather simple. A separate NodeJS process is
started *on the host* (for example Windows), using itself Chokidar to detect
file changes. These events are forwarded as UDP packets *to the guest* where
they are restored as typical Chokidar events.

To make this possible, the *Chokidar* mechanism is completely *replaced* in the
guest, by monkeypatching it in the NodeJS process that's using it.

## How to use

### in your project

Add `fake-chokidar` as a devDependency to your project:

```
npm i --save-dev fake-chokidar
```


Then at the very top of your `webpack.config.js` add this code:

```
require("fake-chokidar").inject({
  port: 12345
});
```

You can choose whatever port you like, but you must configure Docker and your
virtual machine so that the port is forwarded.


### on your development machine

For your **Docker** `run` command, add the option `-p 12345:12345/udp` (with your
chosen port number, of course).

For **VirtualBox** you can do this via the GUI or by running this command once
*while your VM is stopped* (assuming Boot2docker):

```
VBoxManage modifyvm boot2docker-vm --natpf1 "portfwd-12345,udp,,12345,,12345"
```

Again, replace `12345` with the port you choose above.


### while coding

Download the current release of [fake-chokidar-sender](https://github.com/jampy/fake-chokidar-sender/releases)
and keep the program running in the background, like so:

```
fake-chokidar-sender --port 12345 .:/src
```

See the `fake-chokidar-sender` page for more details.


## other solutions

- you can simply instruct Chokidar to use polling (`CHOKIDAR_USEPOLLING=1`
  environment variable), but that can cause high CPU levels for large projects;
  see also see also https://blog.codecentric.de/en/2017/08/fix-webpack-watch-virtualbox/

- [notify-forwarder](https://github.com/mhallin/notify-forwarder) looked
  promising, but didn't work for me. It also forwards file events via UDP but
  tries to mimic Inotify events. Since Linux does not allow to "send" such
  events, the project forces them [by changing the file mtime](https://github.com/mhallin/notify-forwarder/issues/2#issuecomment-143846590)

- Use VMWare instead of VirtualBox, which is said to have a better shared folder
  implementation, but be warned that this means you can't run any VirtualBox
 machines in parallel.


## licence

MIT