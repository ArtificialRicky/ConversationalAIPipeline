import argparse
import asyncio
import logging
import time

from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.signaling import BYE, add_signaling_args, create_signaling


async def run(pc, signaling):
    def add_tracks():
        pass

    @pc.on("track")
    def on_track(track):
        print("Track %s received" % track.kind)

        @track.on("ended")
        async def on_ended():
            print("Track %s ended" % track.kind)

    # connect to signaling
    await signaling.connect()

    # consume signaling
    while True:
        obj = await signaling.receive()

        if isinstance(obj, RTCSessionDescription):
            await pc.setRemoteDescription(obj)

            if obj.type == "offer":
                # send answer
                add_tracks()
                await pc.setLocalDescription(await pc.createAnswer())
                await signaling.send(pc.localDescription)
        elif obj is BYE:
            print("Exiting")
            break


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Data channels ping/pong")
    parser.add_argument("--verbose", "-v", action="count")
    add_signaling_args(parser)
    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    signaling = create_signaling(args)
    pc = RTCPeerConnection()
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(
            run(
                pc=pc,
                signaling=signaling,
            )
        )
    except KeyboardInterrupt:
        pass
    finally:
        loop.run_until_complete(signaling.close())
        loop.run_until_complete(pc.close()) 