import {Pressable, Alert, view,Modal, StatusBar, StyleSheet} from "react-native"
import { ScrollView } from "react-native-web"
import {useState} from "react"
export default function learn(){
    const [isModalVis, SetModal]=useState(false);
    <view>
        <text>Hi</text>
        <button title="Got it" onProgress={()=> console.log("Hello")} />
            <image></image>
            <ScrollView></ScrollView>
            <Pressable onPress={()=>console.log("Onpress")}>

            </Pressable>
          <Button styles={styles.container} title="Close" color="Midnight"/>

            <Modal visible={isModalVis}>
                <view>
                    <text>ModelContent</text>

                </view>
            </Modal>
            <statusbar></statusbar>
          <Button title="Alert" onPress={()=>Alert.alert("Invalid")}/>
    </view>

}

const styles= StyleSheet.create({

    container:{
        flex:1,
        padding:60,
        backgroundColor:"#2B2B2B"
    }
})