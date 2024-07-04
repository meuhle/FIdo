import * as React from 'react';
import { ActivityIndicator, Image, ScrollView, Text, Button, Modal, TextInput, View } from 'react-native';
import { rotateImage } from '../modules/imaging';
import { toBase64Image } from '../utils/base64';
import { Agent } from '../agent/Agent';
import { InvalidateSync } from '../utils/invalidateSync';
import { textToSpeech } from '../modules/openai';

function usePhotos(device: BluetoothRemoteGATTServer) {

    // Subscribe to device
    const [photos, setPhotos] = React.useState<Uint8Array[]>([]);
    const [subscribed, setSubscribed] = React.useState<boolean>(false);
    React.useEffect(() => {
        (async () => {

            let previousChunk = -1;
            let buffer: Uint8Array = new Uint8Array(0);
            function onChunk(id: number | null, data: Uint8Array) {

                // Resolve if packet is the first one
                if (previousChunk === -1) {
                    if (id === null) {
                        return;
                    } else if (id === 0) {
                        previousChunk = 0;
                        buffer = new Uint8Array(0);
                    } else {
                        return;
                    }
                } else {
                    if (id === null) {
                        console.log('Photo received', buffer);
                        rotateImage(buffer, '270').then((rotated) => {
                            console.log('Rotated photo', rotated);
                            setPhotos((p) => [...p, rotated]);
                        });
                        previousChunk = -1;
                        return;
                    } else {
                        if (id !== previousChunk + 1) {
                            previousChunk = -1;
                            console.error('Invalid chunk', id, previousChunk);
                            return;
                        }
                        previousChunk = id;
                    }
                }

                // Append data
                buffer = new Uint8Array([...buffer, ...data]);
            }

            // Subscribe for photo updates
            const service = await device.getPrimaryService('19B10000-E8F2-537E-4F6C-D104768A1214'.toLowerCase());
            const photoCharacteristic = await service.getCharacteristic('19b10005-e8f2-537e-4f6c-d104768a1214');
            await photoCharacteristic.startNotifications();
            setSubscribed(true);
            photoCharacteristic.addEventListener('characteristicvaluechanged', (e) => {
                let value = (e.target as BluetoothRemoteGATTCharacteristic).value!;
                let array = new Uint8Array(value.buffer);
                if (array[0] == 0xff && array[1] == 0xff) {
                    onChunk(null, new Uint8Array());
                } else {
                    let packetId = array[0] + (array[1] << 8);
                    let packet = array.slice(2);
                    onChunk(packetId, packet);
                }
            });
        })();
    }, []);

    return [subscribed, photos] as const;
}

export const DeviceView = React.memo((props: { device: BluetoothRemoteGATTServer }) => {
    const [subscribed, photos] = usePhotos(props.device);
    const agent = React.useMemo(() => new Agent(), []);
    const agentState = agent.use();
    agent.printtrigger();

    const [modalVisible, setModalVisible] = React.useState(false);

    // Background processing agent
    const processedPhotos = React.useRef<Uint8Array[]>([]);
    const sync = React.useMemo(() => {
        let processed = 0;
        return new InvalidateSync(async () => {
            if (processedPhotos.current.length > processed) {
                let unprocessed = processedPhotos.current.slice(processed);
                processed = processedPhotos.current.length;
                await agent.addPhoto(unprocessed);
            }
        });
    }, []);
    React.useEffect(() => {
        processedPhotos.current = photos;
        sync.invalidate();
    }, [photos]);

    // Effect to call agent.answer when a new photo is added
    const previousPhotosCount = React.useRef(photos.length);
    let answer:string = "";
    React.useEffect(() => {
        if (photos.length > previousPhotosCount.current) {
            let question = "There is one or multiple of the following objects: ";
            let trigger = agent.returnTrigger();
            let l = trigger.length;
            for (let i =0 ; i<l ; i++){
                question += trigger[i];
                if(i!=l-1){
                    question += ", ";
                }
            }
            question += " in the last picture? \n"
            question += "THE ANSWER MUST BE IN FORMAT Yes/No. if yes list of objects seen in picture separated by , \n";
            question += "Examples: Yes. Snake,Dog,Cat \n No. \n Yes. Dog \n";
            question += "DO NOT add external object that are not referred to the list";
            agent.answer(question,true);
            console.log(agentState.snakes);
            console.log(agentState.snakesans);
            if (typeof agentState.snakes === 'string' && agentState.snakes != undefined){
                alert("Alert trigger detected: " + agentState.snakes);
            }
        }
        previousPhotosCount.current = photos.length;
    }, [photos]);
    /* Red alert on top if agentState.snakes is defined }*/
/* 
{typeof agentState.snakes === 'string' && agentState.snakes != undefined && (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'red', padding: 10, zIndex: 1000 }}>
        alert(Alert trigger detected: {agentState.snakes}); /*<Text style={{ color: 'white', fontSize: 18 }}> </Text>
    </View>
)}*/
    

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {photos.map((photo, index) => (
                        <Image key={index} style={{ width: 100, height: 100 }} source={{ uri: toBase64Image(photo) }} />
                    ))}
                </View>
            </View>

            <View style={{ backgroundColor: 'rgb(28 28 28)', height: 600, width: 600, borderRadius: 64, flexDirection: 'column', padding: 64 }}>
                <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
                    {agentState.loading && (<ActivityIndicator size="large" color={"white"} />)}
                    {agentState.answer && !agentState.loading && (<ScrollView style={{ flexGrow: 1, flexBasis: 0 }}><Text style={{ color: 'white', fontSize: 32 }}>{agentState.answer}</Text></ScrollView>)}
                </View>
                <TextInput
                    style={{ color: 'white', height: 64, fontSize: 32, borderRadius: 16, backgroundColor: 'rgb(48 48 48)', padding: 16 }}
                    placeholder='What do you need?'
                    placeholderTextColor={'#888'}
                    readOnly={agentState.loading}
                    onSubmitEditing={(e) => agent.answer(e.nativeEvent.text, false)}
                />
            {/*  add part that visualizes the triggers */}
            <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
                    {agentState.triggerstr && (<ScrollView style={{ flexGrow: 1, flexBasis: 0 }}><Text style={{ color: 'white', fontSize: 32 }}>{agentState.triggerstr}</Text></ScrollView>)}
                </View>
<TextInput
                    style={{ color: 'white', height: 64, fontSize: 32, borderRadius: 16, backgroundColor: 'rgb(48 48 48)', padding: 16 }}
                    placeholder='Add a Trigger?'
                    placeholderTextColor={'#888'}
                    readOnly={agentState.loading}
                    onSubmitEditing={(e) => agent.addtrigger(e.nativeEvent.text)}
                />
                <Text style={{ color: '#888', fontSize: 14, marginTop: 10, textAlign: 'center' }}>
                  Enter a keyword to add, retype to delete.
                </Text>
            </View>
             {/* Modal for Notification */}
            
        </View>
    );
});