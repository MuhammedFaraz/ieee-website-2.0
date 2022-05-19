const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.register = functions
  .region("us-central1")
  .https.onCall((data, context) => {
    admin
      .auth()
      .createUser({
        email: data.email,
        emailVerified: false,
        password: data.password,
        displayName: data.displayName,
        photoURL: "http://www.example.com/12345678/photo.png",
        disabled: false,
      })
      .then((userRecord) => {
        console.log(`Success user:${userRecord.uid} has been created`);
        // See the UserRecord reference doc for the contents of userRecord.
      })
      .catch((error) => {
        console.log("Error creating new user:", error);
      });
  });
exports.updateUserRole = functions.https.onCall((data, context) => {
  return admin
    .auth()
    .getUserByEmail(data.email)
    .then((user) => {
      return admin.auth().setCustomUserClaims(user.uid, {
        admin: true,
      });
    })
    .then(() => {
      return {
        message: `Success ${data.email} has been made an admin`,
      };
    })
    .catch((error) => {
      return error;
    });
});
exports.addDefaultUserRole = functions.auth.user().onCreate((user) => {
  let uid = user.uid;

  //add custom claims
  return admin
    .auth()
    .setCustomUserClaims(uid, {
      isMember: true,
    })
    .then(() => {
      //Interesting to note: we need to re-fetch the userRecord, as the user variable **does not** hold the claim
      return admin.auth().getUser(uid);
    })
    .then((userRecord) => {
      console.log(uid);
      console.log(userRecord.customClaims.isMember);
      return null;
    });
});

exports.deleteUserAuth = functions.https.onCall( async (data, context) => {
  console.log(data.email)
  user = await admin.auth().getUserByEmail(data.email)
  return admin.auth().deleteUser(user.uid)
})

//checking scheduled events and updating the event to completed
exports.taskRunner = functions.pubsub
    .schedule('* * * * *').onRun(async (context) => {
    // Consistent timestamp
    const now = admin.firestore.Timestamp.now();
    // Query all documents ready to perform
    const query = db.collection('events').where('scheduleType', '==', 'schedule').where('date', '<=', now);
    await query.get().then( async (snapshots) => {
      //creating promise array to run the query concurrently
      const updatesDocs = []
      //updating each document
      snapshots.forEach((doc) => updatesDocs.push(doc.ref.update({ 
        scheduleType: 'completed'
      })))
      await Promise.all(updatesDocs)
    })
});