# IP Spoofer

Console app to perform **ARP Spoofing** attack on XBOX/PS gaming console to capture IPs of nearby players in games like **GTA Online** and **Red Dead Redemption**.

## How it works?

This app uses [`pcap`](https://npmjs.com/package/pcap) for both capturing and injecting packets for performing ARP Spoofing.

**It works only on Linux/macOS**

## Installation

**Yarn is required** for this app to run, cause it works with `sudo` and passes environment variables. 

```bash
git clone https://github.com/AlexXanderGrib/ip-capture

cd ip-capture

yarn install
yarn build
```


### Running

```bash
sudo yarn start
```

### Configuring

App is configured by providing environment variables, that can be passed through `.env` file. Example configuration:

```bash
# .env
# Ip to Spoof. May not be present, than no arp spoofing will be performed
IP=192.168.0.101

# Port to run web ui on
PORT=8080

# Enabled by default. Set `false` to disable displaying in console
ENABLE_CLI=true

# Network interface to perform ARP Spoofing. By default - any
USE_IFACE=wlp0s20f3
```