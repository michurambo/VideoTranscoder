import React, { useState } from "react";
import { View, Button, Text } from "react-native";
import { FFprobeKit, FFmpegKit } from "ffmpeg-kit-react-native";
import * as FFMKit from "ffmpeg-kit-react-native";
import * as RNFS from "react-native-fs";
import * as RNIP from "react-native-image-picker";

const VideoTranscodeApp = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);

  const handleVideoPick = () => {
    const options = {
      mediaType: "video",
    };

    RNIP.launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log("User cancelled video picker");
      } else if (response.errorCode) {
        console.log("ImagePicker Error:", response.errorMessage);
      } else if (response.assets) {
        setSelectedVideo(response.assets[0]);
        console.log("filename: " + response.assets[0].fileName);
      }
    });
  };
  const inputPath = selectedVideo?.uri;
  console.log("selected video" + selectedVideo?.uri);
  const outputPath = RNFS.TemporaryDirectoryPath + "/test.mp4"; // Replace with the desired output video file path

  const transcodeVideo = () => {
    console.log("URI" + selectedVideo.uri);
    if (!inputPath) {
      console.log("No video selected");
      return;
    }
    processMedia({
      uri: inputPath,
      outputPath: outputPath,
      onProgress: function (progress) {
        console.log(progress);
      },
      onDone: function (richMedia) {
        console.log(richMedia);
      },
      onError: function (error) {
        console.log(error);
      },
    });
  };

  function assembleFFmpegCommand(info, mediaInfo) {
    /*
        FFMPEG PRESET LIST:
        ultrafast
        superfast
        veryfast
        faster
        fast
        medium – default preset
        slow
        slower
        veryslow

        */
    return `-i ${info.uri} -pix_fmt yuv420p -vf "scale='if(gte(iw\,ih)\,min(1280\,iw)\,-2):if(lt(iw\,ih)\,min(1280\,ih)\,-2)'" -c:v libx264 -g 30 -b:v 1.5M -maxrate 2M -bufsize 3M -c:a aac -ac 2 -movflags +faststart ${info.outputPath}`;
  }

  function processMedia(info) {
    if (info === null) {
      throw Error("error is null");
    }
    if (typeof info.onDone !== "function") {
      throw Error("onDone not defined");
    }

    FFprobeKit.getMediaInformation(info.uri).then(async (session) => {
      const information = await session.getMediaInformation();

      if (information === undefined) {
        // CHECK THE FOLLOWING ATTRIBUTES ON ERROR
        const state = FFmpegKitConfig.sessionStateToString(
          await session.getState()
        );
        const returnCode = await session.getReturnCode();
        const failStackTrace = await session.getFailStackTrace();
        const duration = await session.getDuration();
        const output = await session.getOutput();
        info.onError(Error("error, failed to extract media information"));
        return;
      }

      // Get the media duration
      var mediaDuration = information.getDuration();

      // Get the media properties map
      var properties = information.getAllProperties();

      // Get the width and height of the video
      const width = information.getProperty("height");
      const height = properties.streams[0].height;

      // Calculate the aspect ratio
      const aspectRatio = width / height;

      if (mediaDuration > 120) {
        info.onError(Error("Media is too long"));
        return;
      }

      const assembledTranscodeCommand = assembleFFmpegCommand(
        info,
        information
      );

      console.log("==================================");
      console.log("properties" + JSON.stringify(properties));
      console.log("width :" + width + "height: " + height);
      console.log("aspect:" + aspectRatio);
      console.log("==================================");

      console.log(
        "+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++"
      );
      console.log("duration is: " + mediaDuration);
      console.log(
        "+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++"
      );

      //
      // STARTS TRANSCODING SESSION WHEN MEDIA INFORMATION IS PROVIDED
      //
      FFmpegKit.executeAsync(
        assembledTranscodeCommand,
        async (session) => {
          const returnCode = await session.getReturnCode();
          // example for failure info.onError(Error("session not successful"));
          if (FFMKit.ReturnCode.isCancel(returnCode)) {
            return;
          } else if (!FFMKit.ReturnCode.isSuccess(returnCode)) {
            info.onError("Transcode failed");
            info.onError(info.errorMessage);
            return;
          }
          console.log("session is done");
          var media = {
            duration: mediaDuration,
            elements: [{ source: info.outputPath, height: height }],
          };
          info.onDone(JSON.stringify(media));
        },
        (log) => {},
        (statistics) => {
          //TODO: Figure out how to get progress based on statistics
          const currentTime = statistics.getTime() / 1000;
          const progress = Math.min(currentTime / mediaDuration, 1.0);
          info.onProgress(`Progress: ${progress}%`);
          //info.onProgress( statistics.getTime() );
        }
      );
    });
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Button title="Choose Video" onPress={handleVideoPick} />
      <Button
        title="Transcode Video"
        onPress={transcodeVideo}
        disabled={!selectedVideo}
      />
    </View>
  );
};

export default VideoTranscodeApp;
