


// Function to download and store the image
 const saveImageLocally = async (imageUri) => {
  try {
    // Define local file path
    const fileUri = `${FileSystem.documentDirectory}`;

    // Download and save the image
    const downloadedFile = await FileSystem.downloadAsync(imageUri, fileUri);

    if (downloadedFile.status === 200) {
      console.log("Image saved locally at:", downloadedFile.uri);

      // Save the file path in AsyncStorage
      await AsyncStorage.setItem("savedImage", downloadedFile.uri);

      return downloadedFile.uri;
    } else {
      console.error("Failed to download image:", downloadedFile);
      return null;
    }
  } catch (error) {
    console.error("Error saving image locally:", error);
    return null;
  }
};